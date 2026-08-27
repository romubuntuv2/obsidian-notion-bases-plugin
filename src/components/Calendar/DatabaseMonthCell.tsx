import React from 'react'
import { TFile } from 'obsidian'
import { ColumnSchema, ViewConfig } from '../../types'
import { DatabaseManager } from '../../database-manager'
import { t } from '../../i18n'
import { dateKey } from './calendar-utils'
import { CardContextMenuHandler, CardDragHandler, DayClickHandler, DayDragLeaveHandler, DayDragOverHandler, DayDropHandler, RowsByDate } from './calendar-types'
import { DatabaseMonthlyCard } from './DatabaseMonthlyCard'

interface DatabaseMonthCellProps {
	day: number | null
	currentYear: number
	currentMonth: number
	todayDay: number | null
	dragOverDay: number | null
	rowsByDate: RowsByDate
	dbFile: TFile
	manager: DatabaseManager
	activeView: ViewConfig
	dateField: ColumnSchema
	schema: ColumnSchema[]
	visibleColumns: ColumnSchema[]
	onOpenFile: (file: TFile) => void
	onDayClick: DayClickHandler
	onCardDragStart: CardDragHandler
	onCardContextMenu: CardContextMenuHandler
	onDayDragOver: DayDragOverHandler
	onDayDragLeave: DayDragLeaveHandler
	onDayDrop: DayDropHandler
}

export function DatabaseMonthCell(props: DatabaseMonthCellProps) {
	const { day, currentYear, currentMonth, todayDay, dragOverDay, rowsByDate,
		dbFile, manager, activeView, dateField, schema, visibleColumns,
		onOpenFile, onDayClick, onCardDragStart, onCardContextMenu,
		onDayDragOver, onDayDragLeave, onDayDrop } = props
	if (day === null) return <div className="nb-cal-monthly-cell nb-cal-monthly-cell--outside" />
	const isToday = day === todayDay
	const dayRows = rowsByDate.get(dateKey(currentYear, currentMonth, day)) ?? []

	return <div
		className={`nb-cal-monthly-cell${isToday ? ' nb-cal-monthly-cell--today' : ''}${day === dragOverDay ? ' nb-cal-monthly-cell--drag-over' : ''}`}
		onClick={() => { void onDayClick(currentYear, currentMonth, day) }}
		onDragOver={event => onDayDragOver(event, day)} onDragLeave={onDayDragLeave}
		onDrop={event => { void onDayDrop(event, currentYear, currentMonth, day) }}
		title={t('calendar_click_to_create')}>
		<div className="nb-cal-monthly-cell-header"><span className={`nb-cal-day-num${isToday ? ' nb-cal-day-num--today' : ''}`}>{day}</span></div>
		<div className="nb-cal-monthly-cell-body">
			{dayRows.map(row => <DatabaseMonthlyCard key={row._file.path} row={row} dbFile={dbFile}
				manager={manager} activeView={activeView} dateField={dateField} schema={schema} visibleColumns={visibleColumns}
				onOpenFile={onOpenFile} onCardDragStart={onCardDragStart} onContextMenu={onCardContextMenu} />)}
		</div>
	</div>
}
