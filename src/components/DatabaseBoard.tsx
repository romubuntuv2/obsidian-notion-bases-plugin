import { TFile } from 'obsidian'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import { FilterOperator, SelectOption, ViewConfig } from '../types'
import { ActiveFilter, applyFilters, applySorts, getDefaultOperator } from './filter-utils'
import { t } from '../i18n'
import { useDatabaseRows } from '../hooks/useDatabaseRows'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useSaveTracker } from '../hooks/useSaveTracker'
import { stringifyScalar } from '../value-utils'
import { BoardColumn } from './Board/BoardColumn'
import { BoardToolbar } from './Board/BoardToolbar'
import { BoardColumnData, DRAG_TYPE_CARD } from './Board/board-types'
import { showNoteContextMenu } from './ContextMenu/showNoteContextMenu'
import { getFieldMenuColumns, getViewPropertyColumns, getVisibleViewProperties, toggleViewProperty } from '../virtual-properties'
import {
	useSelectorOptionColor, useSelectorOptionCreate, useSelectorOptionDelete, useSelectorOptionRename,
} from '../hooks/useSelectorOptionRename'

interface DatabaseBoardProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

export function DatabaseBoard({ dbFile, manager, externalView, onViewChange }: DatabaseBoardProps) {
	const app = useApp()
	const { status: saveStatus, trackSave } = useSaveTracker()
	const { rows, config, effectiveSchema, loading, activeFilters, setActiveFilters, reload } = useDatabaseRows({
		app, dbFile, manager, includeSubfolders: externalView.includeSubfolders, externalView,
	})
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [editingLimit, setEditingLimit] = useState<string | null>(null)
	const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set())
	const [cardDragOver, setCardDragOver] = useState<string | null>(null)
	const [columnDragOver, setColumnDragOver] = useState<string | null>(null)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	const groupableColumns = useMemo(
		() => effectiveSchema.filter(column => column.type === 'select' || column.type === 'status'),
		[effectiveSchema]
	)
	const groupByColumn = useMemo(
		() => effectiveSchema.find(column => column.id === activeView.groupByColumnId) ?? groupableColumns[0] ?? null,
		[effectiveSchema, activeView.groupByColumnId, groupableColumns]
	)
	const debouncedFilters = useDebouncedValue(activeFilters, 200)
	const filteredRows = useMemo(() => applyFilters(rows, debouncedFilters), [rows, debouncedFilters])
	const sortedRows = useMemo(() => applySorts(filteredRows, activeView.sorts), [filteredRows, activeView.sorts])
	const viewPropertyColumns = useMemo(() => getViewPropertyColumns(effectiveSchema), [effectiveSchema])
	const fieldMenuColumns = getFieldMenuColumns(effectiveSchema)
	const visibleColumns = useMemo(() => getVisibleViewProperties(effectiveSchema, activeView).filter(column =>
		column.id !== groupByColumn?.id && column.type !== 'title'
	), [effectiveSchema, activeView, groupByColumn])

	const defaultStatusOptions = useMemo<SelectOption[]>(() => [
		{ value: t('status_not_started'), color: '#9E9E9E' },
		{ value: t('status_in_progress'), color: '#2196F3' },
		{ value: t('status_done'), color: '#4CAF50' },
		{ value: t('status_cancelled'), color: '#F44336' },
	], [])

	const columns = useMemo<BoardColumnData[]>(() => {
		if (!groupByColumn) return []
		const options = groupByColumn.type === 'status' && !groupByColumn.options?.length
			? defaultStatusOptions : (groupByColumn.options ?? [])
		const available: BoardColumnData[] = [
			...options.map(option => ({ value: option.value, label: option.value, color: option.color,
				rows: sortedRows.filter(row => row[groupByColumn.id] === option.value) })),
			{ value: '', label: t('no_value'), rows: sortedRows.filter(row => {
				const value = row[groupByColumn.id]
				return value === null || value === undefined || stringifyScalar(value).trim() === ''
			}) },
		]
		const order = activeView.boardColumnOrder
		const ordered = order?.length
			? [...order.flatMap(value => { const column = available.find(item => item.value === value); return column ? [column] : [] }),
				...available.filter(column => !order.includes(column.value))]
			: available
		return ordered.filter(column => !(activeView.boardHideEmpty && column.rows.length === 0)
			&& !(activeView.boardHideNoValue && column.value === ''))
	}, [groupByColumn, sortedRows, defaultStatusOptions, activeView.boardColumnOrder,
		activeView.boardHideEmpty, activeView.boardHideNoValue])

	const moveCard = useCallback(async (rowPath: string, targetValue: string) => {
		if (!dbFile || !groupByColumn) return
		const file = app.vault.getFileByPath(rowPath)
		if (!file) return
		await trackSave(app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			if (targetValue === '') delete frontmatter[groupByColumn.id]
			else frontmatter[groupByColumn.id] = targetValue
		}))
	}, [app, dbFile, groupByColumn, trackSave])

	const moveColumn = useCallback(async (fromValue: string, toValue: string) => {
		if (fromValue === toValue) return
		const order = columns.map(column => column.value)
		const fromIndex = order.indexOf(fromValue)
		const toIndex = order.indexOf(toValue)
		if (fromIndex === -1 || toIndex === -1) return
		const next = [...order]
		next.splice(fromIndex, 1)
		next.splice(toIndex, 0, fromValue)
		await saveView({ ...activeView, boardColumnOrder: next })
	}, [columns, activeView, saveView])

	const addCardToColumn = useCallback(async (columnValue: string) => {
		if (!dbFile || !groupByColumn) return
		const newFile = await manager.createNoteWithTemplate(dbFile, undefined, externalView)
		if (columnValue !== '') {
			await trackSave(app.fileManager.processFrontMatter(newFile, (frontmatter: Record<string, unknown>) => {
				frontmatter[groupByColumn.id] = columnValue
			}))
		}
	}, [app, dbFile, manager, groupByColumn, externalView, trackSave])

	const saveActivePills = useCallback(async (filters: ActiveFilter[]) => {
		const pills = filters.map(filter => ({ id: filter.id, columnId: filter.columnId,
			operator: filter.operator, value: filter.value, conjunction: filter.conjunction }))
		await saveView({ ...activeView, activePills: pills })
	}, [saveView, activeView])
	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const next: ActiveFilter[] = [...activeFilters, { id: crypto.randomUUID(), columnId,
			columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '', conjunction: 'and' }]
		setActiveFilters(next); void saveActivePills(next)
	}
	const removeFilter = (id: string) => { const next = activeFilters.filter(filter => filter.id !== id); setActiveFilters(next); void saveActivePills(next) }
	const updateFilter = (id: string, operator: FilterOperator, value: string) => { const next = activeFilters.map(filter => filter.id === id ? { ...filter, operator, value } : filter); setActiveFilters(next); void saveActivePills(next) }
	const toggleConjunction = (id: string) => { const next = activeFilters.map(filter => filter.id === id ? { ...filter, conjunction: filter.conjunction === 'and' ? 'or' as const : 'and' as const } : filter); setActiveFilters(next); void saveActivePills(next) }
	const toggleFieldVisibility = useCallback(async (fieldId: string) => {
		const column = effectiveSchema.find(candidate => candidate.id === fieldId)
		if (!column) return
		await saveView(toggleViewProperty(activeView, column))
	}, [activeView, effectiveSchema, saveView])

	const openFile = useCallback((file: TFile) => { void app.workspace.getLeaf().openFile(file) }, [app])
	const handleCardDragStart = useCallback((event: React.DragEvent, filePath: string) => {
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setData('nb-drag-type', DRAG_TYPE_CARD)
		event.dataTransfer.setData('nb-row-path', filePath)
		event.dataTransfer.setData(DRAG_TYPE_CARD, '')
	}, [])
	const handleCardContextMenu = useCallback((event: React.MouseEvent, file: TFile) => {
		showNoteContextMenu({ event: event.nativeEvent, app, manager, file })
	}, [app, manager])
	const reloadAfterOptionRename = useCallback(() => { void reload() }, [reload])
	const renameSelectorOption = useSelectorOptionRename({ manager, dbFile, config, onComplete: reloadAfterOptionRename })
	const createSelectorOption = useSelectorOptionCreate({ manager, dbFile, config })
	const colorSelectorOption = useSelectorOptionColor({ manager, dbFile, config })
	const deleteSelectorOption = useSelectorOptionDelete({ app, manager, dbFile, config, onComplete: reloadAfterOptionRename })

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>
	if (groupableColumns.length === 0) return <div className="nb-empty-state"><p>{t('board_no_select_col')}</p><p>{t('board_add_select_hint')}</p></div>

	return <div className="nb-container">
		<BoardToolbar view={activeView} schema={viewPropertyColumns} fieldMenuSchema={fieldMenuColumns} groupableColumns={groupableColumns}
			groupByColumn={groupByColumn} rowCount={filteredRows.length} saveStatus={saveStatus}
			activeFilters={activeFilters} onSaveView={saveView} onToggleField={toggleFieldVisibility}
			onAddFilter={addFilter} onUpdateFilter={updateFilter} onRemoveFilter={removeFilter}
			onToggleConjunction={toggleConjunction} />
		<div className="nb-board">
			{columns.map(column => <BoardColumn key={column.value || '__no_value__'} column={column}
				cardDragOver={cardDragOver} columnDragOver={columnDragOver} view={activeView}
				schema={effectiveSchema} visibleColumns={visibleColumns}
				manager={manager} editingLimit={editingLimit} expanded={expandedColumns.has(column.value)}
				onSetEditingLimit={setEditingLimit}
				onSetExpanded={expanded => setExpandedColumns(current => { const next = new Set(current); if (expanded) next.add(column.value); else next.delete(column.value); return next })}
				onSetCardDragOver={setCardDragOver} onSetColumnDragOver={setColumnDragOver}
				onSaveView={saveView} onMoveCard={moveCard} onMoveColumn={moveColumn}
				onAddCard={addCardToColumn} onOpenFile={openFile} onCardDragStart={handleCardDragStart}
				onCardContextMenu={handleCardContextMenu} onRenameOption={renameSelectorOption}
				onCreateOption={createSelectorOption} onColorOption={colorSelectorOption}
				onDeleteOption={deleteSelectorOption} />)}
		</div>
	</div>
}
