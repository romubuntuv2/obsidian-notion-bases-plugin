import React, { useEffect, useRef, useState } from 'react'
import { ActiveFilter, getColumnIconStatic } from '../filter-utils'
import { ColumnSchema, ConditionalFormatRule, FilterOperator, ViewConfig } from '../../types'
import { t } from '../../i18n'
import { SaveIndicator } from '../SaveIndicator'
import { FilterPillsRow } from '../FilterPillsRow'
import { ConditionalFormatPanel } from '../ConditionalFormatPanel'

interface BoardToolbarProps {
	view: ViewConfig
	schema: ColumnSchema[]
	groupableColumns: ColumnSchema[]
	groupByColumn: ColumnSchema | null
	rowCount: number
	saveStatus: React.ComponentProps<typeof SaveIndicator>['status']
	activeFilters: ActiveFilter[]
	onSaveView: (view: ViewConfig) => Promise<void>
	onToggleField: (fieldId: string) => Promise<void>
	onAddFilter: (columnId: string, columnName: string, icon: string, columnType: string) => void
	onUpdateFilter: (id: string, operator: FilterOperator, value: string) => void
	onRemoveFilter: (id: string) => void
	onToggleConjunction: (id: string) => void
}

export function BoardToolbar({ view, schema, groupableColumns, groupByColumn, rowCount,
	saveStatus, activeFilters, onSaveView, onToggleField, onAddFilter, onUpdateFilter,
	onRemoveFilter, onToggleConjunction }: BoardToolbarProps) {
	const [fieldsOpen, setFieldsOpen] = useState(false)
	const [groupByOpen, setGroupByOpen] = useState(false)
	const [filterOpen, setFilterOpen] = useState(false)
	const [formatOpen, setFormatOpen] = useState(false)
	const fieldsRef = useRef<HTMLDivElement>(null)
	const groupByRef = useRef<HTMLDivElement>(null)
	const filterRef = useRef<HTMLDivElement>(null)
	const formatRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!fieldsOpen && !groupByOpen && !filterOpen && !formatOpen) return
		const closeOutside = (event: MouseEvent) => {
			const target = event.target as Node
			if (fieldsOpen && !fieldsRef.current?.contains(target)) setFieldsOpen(false)
			if (groupByOpen && !groupByRef.current?.contains(target)) setGroupByOpen(false)
			if (filterOpen && !filterRef.current?.contains(target)) setFilterOpen(false)
			if (formatOpen && !formatRef.current?.contains(target)) setFormatOpen(false)
		}
		activeDocument.addEventListener('mousedown', closeOutside)
		return () => activeDocument.removeEventListener('mousedown', closeOutside)
	}, [fieldsOpen, groupByOpen, filterOpen, formatOpen])

	const formattingCount = view.conditionalFormats?.length ?? 0
	const saveFormats = (rules: ConditionalFormatRule[]) => { void onSaveView({ ...view, conditionalFormats: rules }) }

	return <>
		<div className="nb-toolbar">
			<div className="nb-fields-menu-wrapper" ref={fieldsRef}>
				<button className={`nb-toolbar-btn${fieldsOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsOpen(value => !value)}>{t('fields')}</button>
				{fieldsOpen && <div className="nb-fields-dropdown">
					<div className="nb-fields-dropdown-label">{t('fields_in_card')}</div>
					{schema.filter(column => column.id !== groupByColumn?.id && column.type !== 'title').map(column => <label key={column.id} className="nb-field-row">
						<input type="checkbox" className="nb-field-checkbox" checked={column.visible && !view.hiddenColumns.includes(column.id)} onChange={() => { void onToggleField(column.id) }} />
						<span className="nb-field-icon">{getColumnIconStatic(column.type)}</span><span className="nb-field-name">{column.name}</span>
					</label>)}
				</div>}
			</div>
			<div className="nb-fields-menu-wrapper" ref={groupByRef}>
				<button className={`nb-toolbar-btn${groupByOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setGroupByOpen(value => !value)}>{t('group_by')}: <strong>{groupByColumn?.name ?? '—'}</strong></button>
				{groupByOpen && <div className="nb-fields-dropdown">
					<div className="nb-fields-dropdown-label">{t('group_by_label')}</div>
					{groupableColumns.map(column => <button key={column.id} className={`nb-menu-item${view.groupByColumnId === column.id ? ' nb-menu-item--active' : ''}`}
						onClick={() => { void onSaveView({ ...view, groupByColumnId: column.id }); setGroupByOpen(false) }}>
						<span className="nb-menu-item-icon">{getColumnIconStatic(column.type)}</span><span>{column.name}</span>
					</button>)}
				</div>}
			</div>
			<label className="nb-toolbar-btn nb-toolbar-toggle"><input type="checkbox" checked={view.boardHideEmpty ?? false} onChange={event => { void onSaveView({ ...view, boardHideEmpty: event.target.checked }) }} />{t('hide_empty_cols')}</label>
			<label className="nb-toolbar-btn nb-toolbar-toggle"><input type="checkbox" checked={view.boardHideNoValue ?? false} onChange={event => { void onSaveView({ ...view, boardHideNoValue: event.target.checked }) }} />{t('hide_no_value_cols')}</label>
			<button className={`nb-toolbar-btn nb-toolbar-btn--icon nb-subfolder-toggle ${view.includeSubfolders ? 'nb-toolbar-btn--active' : ''}`}
				onClick={() => { void onSaveView({ ...view, includeSubfolders: !view.includeSubfolders }) }} title={t('tooltip_include_subfolders')}>
				<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
			</button>
			<span className="nb-row-count">{rowCount} {rowCount === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}</span>
			<SaveIndicator status={saveStatus} />
			<div className="nb-fields-menu-wrapper" ref={filterRef} style={{ marginLeft: 'auto' }}>
				<button className={`nb-toolbar-btn nb-toolbar-btn--icon${filterOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFilterOpen(value => !value)} title={t('filters')}>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
					{activeFilters.length > 0 && <span className="nb-hidden-badge">{activeFilters.length}</span>}
				</button>
				{filterOpen && <div className="nb-fields-dropdown nb-filter-menu-dropdown">
					<div className="nb-fields-dropdown-label">{t('filter_by')}</div>
					<button className="nb-menu-item" onClick={() => { onAddFilter('_title', t('name_column'), '📄', 'title'); setFilterOpen(false) }}><span className="nb-menu-item-icon">📄</span><span>{t('name_column')}</span></button>
					{schema.map(column => <button key={column.id} className="nb-menu-item" onClick={() => { onAddFilter(column.id, column.name, getColumnIconStatic(column.type), column.type); setFilterOpen(false) }}><span className="nb-menu-item-icon">{getColumnIconStatic(column.type)}</span><span>{column.name}</span></button>)}
				</div>}
			</div>
			<div className="nb-fields-menu-wrapper" ref={formatRef}>
				<button className={`nb-toolbar-btn nb-toolbar-btn--icon${formattingCount > 0 ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFormatOpen(value => !value)} title={t('conditional_formatting')}>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/></svg>
					{formattingCount > 0 && <span className="nb-hidden-badge">{formattingCount}</span>}
				</button>
				{formatOpen && <ConditionalFormatPanel rules={view.conditionalFormats ?? []} schema={schema} onChange={saveFormats} onClose={() => setFormatOpen(false)} />}
			</div>
		</div>
		<FilterPillsRow activeFilters={activeFilters} schema={schema} onUpdate={onUpdateFilter}
			onRemove={onRemoveFilter} onToggleConjunction={onToggleConjunction}
			collapsed={!!view.filtersCollapsed}
			onToggleCollapsed={() => { void onSaveView({ ...view, filtersCollapsed: !view.filtersCollapsed }) }} />
	</>
}
