import { TFile } from 'obsidian'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context'
import { DatabaseManager } from '../database-manager'
import {
	FilterOperator, NoteRow, ViewConfig,
} from '../types'
import {
	ActiveFilter, applyFilters,
	getColumnIconStatic, getDefaultOperator,
} from './filter-utils'
import { FilterPillsRow } from './FilterPillsRow'
import { t } from '../i18n'
import { useDatabaseRows } from '../hooks/useDatabaseRows'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { SaveIndicator } from './SaveIndicator'
import { useSaveTracker } from '../hooks/useSaveTracker'
import { stringifyScalar } from '../value-utils'
import { ConditionalFormatPanel } from './ConditionalFormatPanel'
import { DatabaseWeekView } from './Calendar/DatabaseWeekView'
import { DatabaseMonthView } from './Calendar/DatabaseMonthView'
import { DatabaseNoDateRows } from './Calendar/DatabaseNoDateRows'
import {
	buildCalendarGrid, buildWeekGrid, dateKey, formatWeekRange, monthsLong, parseDateValue,
} from './Calendar/calendar-utils'
import { showNoteContextMenu } from './ContextMenu/showNoteContextMenu'
import {
	getFieldMenuColumns, getPropertyCapabilities, getPropertyIcon, getViewPropertyColumns, getVisibleViewProperties,
	isPropertyVisibleInView, toggleViewProperty,
} from '../virtual-properties'
import {
	useSelectorOptionColor, useSelectorOptionCreate, useSelectorOptionDelete, useSelectorOptionRename,
} from '../hooks/useSelectorOptionRename'

interface DatabaseCalendarProps {
	dbFile: TFile | null
	manager: DatabaseManager
	externalView: ViewConfig
	onViewChange: (view: ViewConfig) => Promise<void>
}

export function DatabaseCalendar({ dbFile, manager, externalView, onViewChange }: DatabaseCalendarProps) {
	const app = useApp()
	const { status: saveStatus, trackSave } = useSaveTracker()
	const today = new Date()
	const { rows, config, effectiveSchema, loading, activeFilters, setActiveFilters, reload } = useDatabaseRows({
		app, dbFile, manager, includeSubfolders: externalView.includeSubfolders, externalView,
	})
	const [activeView, setActiveView] = useState<ViewConfig>(externalView)
	const [currentYear, setCurrentYear] = useState(today.getFullYear())
	const [currentMonth, setCurrentMonth] = useState(today.getMonth())
	const [currentDay, setCurrentDay] = useState(today.getDate())
	const [filterMenuOpen, setFilterMenuOpen] = useState(false)
	const [cfPanelOpen, setCfPanelOpen] = useState(false)
	const [fieldsMenuOpen, setFieldsMenuOpen] = useState(false)
	const [dateFieldMenuOpen, setDateFieldMenuOpen] = useState(false)
	const [dragOverDay, setDragOverDay] = useState<number | null>(null)
	const weekBodyRef = useRef<HTMLDivElement>(null)
	const [nowMinutes, setNowMinutes] = useState(() => { const n = new Date(); return n.getHours() * 60 + n.getMinutes() })

	const filterMenuRef = useRef<HTMLDivElement>(null)
	const fieldsMenuRef = useRef<HTMLDivElement>(null)
	const dateFieldMenuRef = useRef<HTMLDivElement>(null)
	const cfPanelRef = useRef<HTMLDivElement>(null)

	useEffect(() => { setActiveView(externalView) }, [externalView.id])

	// Update current time indicator every minute
	useEffect(() => {
		const tick = () => { const n = new Date(); setNowMinutes(n.getHours() * 60 + n.getMinutes()) }
		const id = window.setInterval(tick, 60_000)
		return () => window.clearInterval(id)
	}, [])

	const saveView = useCallback(async (updated: ViewConfig) => {
		setActiveView(updated)
		await onViewChange(updated)
	}, [onViewChange])

	const viewMode = activeView.calendarViewMode ?? 'month'

	// ── Close menus on outside click ─────────────────────────────────────────

	useEffect(() => {
		if (!filterMenuOpen) return
		const h = (e: MouseEvent) => {
			if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) setFilterMenuOpen(false)
		}
		activeDocument.addEventListener('mousedown', h); return () => activeDocument.removeEventListener('mousedown', h)
	}, [filterMenuOpen])

	useEffect(() => {
		if (!fieldsMenuOpen) return
		const h = (e: MouseEvent) => {
			if (fieldsMenuRef.current && !fieldsMenuRef.current.contains(e.target as Node)) setFieldsMenuOpen(false)
		}
		activeDocument.addEventListener('mousedown', h); return () => activeDocument.removeEventListener('mousedown', h)
	}, [fieldsMenuOpen])

	useEffect(() => {
		if (!dateFieldMenuOpen) return
		const h = (e: MouseEvent) => {
			if (dateFieldMenuRef.current && !dateFieldMenuRef.current.contains(e.target as Node)) setDateFieldMenuOpen(false)
		}
		activeDocument.addEventListener('mousedown', h); return () => activeDocument.removeEventListener('mousedown', h)
	}, [dateFieldMenuOpen])

	useEffect(() => {
		if (!cfPanelOpen) return

		const h = (e: MouseEvent) => {
			if (
				cfPanelRef.current &&
				!cfPanelRef.current.contains(e.target as Node)
			) {
				setCfPanelOpen(false)
			}
		}

		activeDocument.addEventListener("mousedown", h)
		return () => activeDocument.removeEventListener("mousedown", h)
	}, [cfPanelOpen])

	// ── Derived data ─────────────────────────────────────────────────────────

	const debouncedFilters = useDebouncedValue(activeFilters, 200)
	const filteredRows = useMemo(() => applyFilters(rows, debouncedFilters), [rows, debouncedFilters])

	const dateField = useMemo(
		() => effectiveSchema.find(c => c.id === activeView.calendarDateField && c.type === 'date'
			&& getPropertyCapabilities(c).editable) ?? null,
		[effectiveSchema, activeView.calendarDateField]
	)

	const visibleCols = useMemo(
		() => getVisibleViewProperties(effectiveSchema, activeView),
		[effectiveSchema, activeView]
	)
	const compactCardColumns = useMemo(() => visibleCols.filter(col =>
		(col.type === 'date' && getPropertyCapabilities(col).editable) || col.propertyScope !== 'database'
	), [visibleCols])
	const viewPropertyColumns = useMemo(() => getViewPropertyColumns(effectiveSchema), [effectiveSchema])
	const fieldMenuColumns = getFieldMenuColumns(effectiveSchema)

	const calendarCells = useMemo(() => buildCalendarGrid(currentYear, currentMonth), [currentYear, currentMonth])

	const weekDays = useMemo(
		() => viewMode === 'week' ? buildWeekGrid(currentYear, currentMonth, currentDay) : [],
		[viewMode, currentYear, currentMonth, currentDay]
	)

	const rowsByDate = useMemo(() => {
		const map = new Map<string, NoteRow[]>()
		if (!dateField) return map
		for (const row of filteredRows) {
			const parsed = parseDateValue((row as Record<string, unknown>)[dateField.id])
			if (!parsed) continue
			const key = dateKey(parsed.year, parsed.month, parsed.day)
			if (viewMode === 'week') {
				const match = weekDays.some(d =>
					d.getFullYear() === parsed.year && d.getMonth() === parsed.month && d.getDate() === parsed.day
				)
				if (match) {
					const existing = map.get(key) ?? []
					existing.push(row)
					map.set(key, existing)
				}
			} else {
				if (parsed.year === currentYear && parsed.month === currentMonth) {
					const existing = map.get(key) ?? []
					existing.push(row)
					map.set(key, existing)
				}
			}
		}
		// Sort entries within each day by time (entries without time come first)
		for (const [key, dayRows] of map) {
			dayRows.sort((a, b) => {
				const pa = parseDateValue((a as Record<string, unknown>)[dateField.id])
				const pb = parseDateValue((b as Record<string, unknown>)[dateField.id])
				const ta = (pa?.hour ?? -1) * 60 + (pa?.minute ?? -1)
				const tb = (pb?.hour ?? -1) * 60 + (pb?.minute ?? -1)
				return ta - tb
			})
			map.set(key, dayRows)
		}
		return map
	}, [filteredRows, dateField, currentYear, currentMonth, currentDay, viewMode, weekDays])

	const noDateRows = useMemo(() => {
		if (!dateField) return []
		return filteredRows.filter(row => {
			const val = (row as Record<string, unknown>)[dateField.id]
			return !val || stringifyScalar(val).trim() === ''
		})
	}, [filteredRows, dateField])

	// Earliest timed card in current week (minutes from midnight)
	const earliestTimedMinute = useMemo(() => {
		if (viewMode !== 'week' || !dateField) return null
		let earliest: number | null = null
		for (const [, dayRows] of rowsByDate) {
			for (const row of dayRows) {
				const p = parseDateValue((row as Record<string, unknown>)[dateField.id])
				if (p && p.hour !== undefined && p.minute !== undefined) {
					const m = p.hour * 60 + p.minute
					if (earliest === null || m < earliest) earliest = m
				}
			}
		}
		return earliest
	}, [viewMode, dateField, rowsByDate])

	// Auto-scroll week body to current time or earliest card
	const weekAnchor = viewMode === 'week' && weekDays.length > 0 ? weekDays[0].toISOString() : ''
	useEffect(() => {
		if (viewMode !== 'week' || loading) return
		const timer = window.setTimeout(() => {
			const el = weekBodyRef.current
			if (!el || el.scrollHeight <= el.clientHeight) return
			const SLOT_HEIGHT = 48
			const totalHeight = SLOT_HEIGHT * 24
			const targetMinutes = earliestTimedMinute !== null ? Math.min(earliestTimedMinute, nowMinutes) : nowMinutes
			const targetPx = (targetMinutes / 1440) * totalHeight
			const viewportHeight = el.clientHeight
			el.scrollTo({ top: Math.max(0, targetPx - viewportHeight * 0.25), behavior: 'smooth' })
		}, 100)
		return () => window.clearTimeout(timer)
	}, [viewMode, weekAnchor, loading])

	// ── Actions ───────────────────────────────────────────────────────────────

	const saveActivePills = useCallback(async (filters: ActiveFilter[]) => {
		const pills = filters.map(f => ({ id: f.id, columnId: f.columnId, operator: f.operator, value: f.value, conjunction: f.conjunction }))
		await saveView({ ...activeView, activePills: pills })
	}, [saveView, activeView])

	const addFilter = (columnId: string, columnName: string, icon: string, columnType: string) => {
		const next: ActiveFilter[] = [...activeFilters, { id: crypto.randomUUID(), columnId, columnName, columnType, icon, operator: getDefaultOperator(columnType), value: '', conjunction: 'and' }]
		setActiveFilters(next); void saveActivePills(next); setFilterMenuOpen(false)
	}
	const removeFilter = (id: string) => { const next = activeFilters.filter(f => f.id !== id); setActiveFilters(next); void saveActivePills(next) }
	const updateFilter = (id: string, operator: FilterOperator, value: string) => { const next = activeFilters.map(f => f.id === id ? { ...f, operator, value } : f); setActiveFilters(next); void saveActivePills(next) }
	const toggleConjunction = (id: string) => { const next = activeFilters.map(f => f.id === id ? { ...f, conjunction: f.conjunction === 'and' ? 'or' as const : 'and' as const } : f); setActiveFilters(next); void saveActivePills(next) }

	const toggleFieldVisibility = useCallback(async (fieldId: string) => {
		const column = effectiveSchema.find(candidate => candidate.id === fieldId)
		if (!column) return
		await saveView(toggleViewProperty(activeView, column))
	}, [activeView, effectiveSchema, saveView])

	const goToPrev = () => {
		if (viewMode === 'week') {
			const d = new Date(currentYear, currentMonth, currentDay - 7)
			setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth()); setCurrentDay(d.getDate())
		} else {
			if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1) }
			else setCurrentMonth(m => m - 1)
		}
	}
	const goToNext = () => {
		if (viewMode === 'week') {
			const d = new Date(currentYear, currentMonth, currentDay + 7)
			setCurrentYear(d.getFullYear()); setCurrentMonth(d.getMonth()); setCurrentDay(d.getDate())
		} else {
			if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1) }
			else setCurrentMonth(m => m + 1)
		}
	}
	const goToToday = () => {
		setCurrentYear(today.getFullYear())
		setCurrentMonth(today.getMonth())
		setCurrentDay(today.getDate())
	}

	const handleDayClick = async (year: number, month: number, day: number) => {
		if (!dbFile || !dateField) return
		const newFile = await manager.createNoteWithTemplate(dbFile, undefined, externalView)
		const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		await trackSave(app.fileManager.processFrontMatter(newFile, (fm: Record<string, unknown>) => { fm[dateField.id] = dateStr }))
	}

	const handleCardDragStart = (e: React.DragEvent, row: NoteRow) => {
		e.dataTransfer.setData('nb-cal-path', row._file.path)
		e.dataTransfer.effectAllowed = 'move'
		e.stopPropagation()
	}

	const handleDayDragOver = (e: React.DragEvent, day: number) => {
		if (!e.dataTransfer.types.includes('nb-cal-path')) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		setDragOverDay(day)
	}

	const handleDayDragLeave = (e: React.DragEvent) => {
		if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverDay(null)
	}

	const handleDayDrop = async (e: React.DragEvent, year: number, month: number, day: number) => {
		e.preventDefault()
		e.stopPropagation()
		setDragOverDay(null)
		const path = e.dataTransfer.getData('nb-cal-path')
		if (!path || !dateField) return
		const file = app.vault.getFileByPath(path)
		if (!file) return
		const datePart = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
		await trackSave(app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			const existing = fm[dateField.id]
			if (typeof existing === 'string' && existing.includes('T')) {
				fm[dateField.id] = `${datePart}T${existing.split('T')[1]}`
			} else {
				fm[dateField.id] = datePart
			}
		}))
	}

	// ── Render ────────────────────────────────────────────────────────────────

	const openFile = useCallback((file: TFile) => {
		void app.workspace.getLeaf().openFile(file)
	}, [app])
	const handleCardContextMenu = useCallback((event: React.MouseEvent, row: NoteRow) => {
		showNoteContextMenu({ event: event.nativeEvent, app, manager, file: row._file })
	}, [app, manager])
	const reloadAfterOptionRename = useCallback(() => { void reload() }, [reload])
	const renameSelectorOption = useSelectorOptionRename({ manager, dbFile, config, onComplete: reloadAfterOptionRename })
	const createSelectorOption = useSelectorOptionCreate({ manager, dbFile, config })
	const colorSelectorOption = useSelectorOptionColor({ manager, dbFile, config })
	const deleteSelectorOption = useSelectorOptionDelete({ app, manager, dbFile, config, onComplete: reloadAfterOptionRename })

	if (!dbFile) return <div className="nb-empty-state"><p>{t('no_database_open')}</p></div>
	if (loading) return <div className="nb-loading">{t('loading')}</div>

	const todayDay = today.getFullYear() === currentYear && today.getMonth() === currentMonth ? today.getDate() : null

	const toolbarContent = (
		<>
			{/* Desktop Toolbar */}
			<div className="nb-toolbar">
				{/* Campo de data */}
				<div className="nb-fields-menu-wrapper" ref={dateFieldMenuRef}>
					<button className={`nb-toolbar-btn${dateFieldMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setDateFieldMenuOpen(v => !v)}>
						{t('date_field')}: <strong>{dateField?.name ?? t('none_value')}</strong>
					</button>
					{dateFieldMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('date_field_label')}</div>
							<button
								className={`nb-menu-item${!activeView.calendarDateField ? ' nb-menu-item--active' : ''}`}
								onClick={() => { void saveView({ ...activeView, calendarDateField: undefined }); setDateFieldMenuOpen(false) }}
							>
								<span className="nb-menu-item-icon">—</span>
								<span>{t('none_value')}</span>
							</button>
							{effectiveSchema.filter(c => c.type === 'date' && getPropertyCapabilities(c).editable).map(col => (
								<button
									key={col.id}
									className={`nb-menu-item${activeView.calendarDateField === col.id ? ' nb-menu-item--active' : ''}`}
									onClick={() => { void saveView({ ...activeView, calendarDateField: col.id }); setDateFieldMenuOpen(false) }}
								>
									<span className="nb-menu-item-icon">📅</span>
									<span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Campos */}
				<div className="nb-fields-menu-wrapper" ref={fieldsMenuRef}>
					<button className={`nb-toolbar-btn${fieldsMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFieldsMenuOpen(v => !v)}>
						{t('fields')}
					</button>
					{fieldsMenuOpen && (
						<div className="nb-fields-dropdown">
							<div className="nb-fields-dropdown-label">{t('fields_label')}</div>
							{fieldMenuColumns.map(col => (
								<label key={col.id} className="nb-field-row">
									<input type="checkbox" className="nb-field-checkbox" checked={isPropertyVisibleInView(col, activeView)} onChange={() => { void toggleFieldVisibility(col.id) }} />
									<span className="nb-field-icon">{getPropertyIcon(col) ?? getColumnIconStatic(col.type)}</span>
									<span className="nb-field-name">{col.name}</span>
								</label>
							))}
						</div>
					)}
				</div>

				{/* View mode toggle */}
				<div className="nb-cal-view-toggle">
					{(['month', 'week'] as const).map(m => (
						<button key={m} className={`nb-cal-view-btn${viewMode === m ? ' nb-cal-view-btn--active' : ''}`}
							onClick={() => { void saveView({ ...activeView, calendarViewMode: m }) }}>
							{m === 'month' ? t('calendar_view_month') : t('calendar_view_week')}
						</button>
					))}
				</div>

				{/* Navegação */}
				<div className="nb-cal-nav">
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToPrev} title={viewMode === 'week' ? t('calendar_prev_week') : t('calendar_prev_month')}>‹</button>
					<button className="nb-toolbar-btn nb-cal-today-btn" onClick={goToToday}>{t('calendar_today')}</button>
					<span className="nb-cal-month-label">
						{viewMode === 'week' ? formatWeekRange(weekDays) : `${monthsLong()[currentMonth]} ${currentYear}`}
					</span>
					<button className="nb-toolbar-btn nb-cal-nav-arrow" onClick={goToNext} title={viewMode === 'week' ? t('calendar_next_week') : t('calendar_next_month')}>›</button>
				</div>

				<button
					className={`nb-toolbar-btn nb-toolbar-btn--icon nb-subfolder-toggle ${activeView.includeSubfolders ? 'nb-toolbar-btn--active' : ''}`}
					onClick={() => { void saveView({ ...activeView, includeSubfolders: !activeView.includeSubfolders }) }}
					title={t('tooltip_include_subfolders')}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
						<line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/>
					</svg>
				</button>

				<span className="nb-row-count">{filteredRows.length} {filteredRows.length === 1 ? t('item_singular').toLowerCase() : t('item_plural').toLowerCase()}</span>
				<SaveIndicator status={saveStatus} />

				{/* Filtros */}
				<div className="nb-fields-menu-wrapper" ref={filterMenuRef} style={{ marginLeft: 'auto' }}>
					<button className={`nb-toolbar-btn nb-toolbar-btn--icon${filterMenuOpen ? ' nb-toolbar-btn--active' : ''}`} onClick={() => setFilterMenuOpen(v => !v)} title={t('filters')}>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
						</svg>
						{activeFilters.length > 0 && <span className="nb-hidden-badge">{activeFilters.length}</span>}
					</button>
					{filterMenuOpen && (
						<div className="nb-fields-dropdown nb-filter-menu-dropdown">
							<div className="nb-fields-dropdown-label">{t('filter_by')}</div>
							<button className="nb-menu-item" onClick={() => addFilter('_title', 'Nome', '📄', 'title')}>
								<span className="nb-menu-item-icon">📄</span><span>{t('name_column')}</span>
							</button>
							{viewPropertyColumns.map(col => (
								<button key={col.id} className="nb-menu-item" onClick={() => addFilter(col.id, col.name, getColumnIconStatic(col.type), col.type)}>
									<span className="nb-menu-item-icon">{getColumnIconStatic(col.type)}</span>
									<span>{col.name}</span>
								</button>
							))}
						</div>
					)}
				</div>

				{/* Conditional formatting */}
				<div className="nb-fields-menu-wrapper" ref={cfPanelRef}>
					<button
						className={`nb-toolbar-btn nb-toolbar-btn--icon${(activeView.conditionalFormats?.length ?? 0) > 0 ? ' nb-toolbar-btn--active' : ''}`}
						onClick={() => setCfPanelOpen(v => !v)}
						title={t('conditional_formatting')}
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18" /><path d="M3 15h18" /><path d="M9 3v18" />
						</svg>
						{(activeView.conditionalFormats?.length ?? 0) > 0 && <span className="nb-hidden-badge">{activeView.conditionalFormats!.length}</span>}
					</button>
					{cfPanelOpen && (
						<ConditionalFormatPanel
							rules={activeView.conditionalFormats ?? []}
							schema={effectiveSchema}
							onChange={rules => { void saveView({ ...activeView, conditionalFormats: rules }) }}
							onClose={() => setCfPanelOpen(false)}
						/>
					)}
				</div>
			</div>

			{/* Filter pills */}
			<FilterPillsRow
				activeFilters={activeFilters}
				schema={effectiveSchema}
				onUpdate={updateFilter}
				onRemove={removeFilter}
				onToggleConjunction={toggleConjunction}
				collapsed={!!activeView.filtersCollapsed}
				onToggleCollapsed={() => { void saveView({ ...activeView, filtersCollapsed: !activeView.filtersCollapsed }) }}
			/>
		</>
	)
	return (
		<div className="nb-container">
			{toolbarContent}

			{/* Calendar body */}
			{!dateField ? (
				<div className="nb-cal-no-field">
					<p>{t('calendar_no_date_field')}</p>
				</div>
			) : (
				<div className='nb-cal-view'>
					{viewMode === 'week' ?
						<DatabaseWeekView dateField={dateField} visibleColumns={compactCardColumns}
							manager={manager} weekDays={weekDays} rowsByDate={rowsByDate}
							today={today} nowMinutes={nowMinutes} bodyRef={weekBodyRef}
							onDayClick={handleDayClick} onCardDragStart={handleCardDragStart}
							onDayDragOver={handleDayDragOver} onDayDragLeave={handleDayDragLeave}
							onDayDrop={handleDayDrop} onOpenRow={row => openFile(row._file)}
							onCardContextMenu={handleCardContextMenu} onRenameOption={renameSelectorOption}
							onCreateOption={createSelectorOption} onColorOption={colorSelectorOption}
							onDeleteOption={deleteSelectorOption} />
						: <DatabaseMonthView calendarCells={calendarCells} cellProps={{
							currentYear, currentMonth, todayDay, dragOverDay, rowsByDate,
							manager, activeView, dateField, schema: effectiveSchema, visibleColumns: visibleCols,
							onOpenFile: openFile, onDayClick: handleDayClick, onCardDragStart: handleCardDragStart,
							onCardContextMenu: handleCardContextMenu,
							onRenameOption: renameSelectorOption,
							onCreateOption: createSelectorOption,
							onColorOption: colorSelectorOption,
							onDeleteOption: deleteSelectorOption,
							onDayDragOver: handleDayDragOver, onDayDragLeave: handleDayDragLeave, onDayDrop: handleDayDrop,
						}} />
					}
					{noDateRows.length > 0 && <DatabaseNoDateRows rows={noDateRows}
						manager={manager} visibleColumns={compactCardColumns} onOpenFile={openFile}
						onCardDragStart={handleCardDragStart} onCardContextMenu={handleCardContextMenu}
						onRenameOption={renameSelectorOption} onCreateOption={createSelectorOption}
						onColorOption={colorSelectorOption} onDeleteOption={deleteSelectorOption} />}
				</div>
			)}
		</div>
	)
}
