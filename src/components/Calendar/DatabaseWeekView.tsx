import React from 'react'
import { ColumnSchema, NoteRow } from '../../types'
import { DatabaseManager } from '../../database-manager'
import { t } from '../../i18n'
import EditableCardProperties from '../EditableFields/EditableCardProperties'
import EditableTitle from '../EditableFields/EditableTitle'
import { dateKey, daysShort, formatTime, parseDateValue } from './calendar-utils'
import {
	CardContextMenuHandler, CardDragHandler, DayClickHandler, DayDragLeaveHandler, DayDragOverHandler,
	DayDropHandler, RowsByDate,
} from './calendar-types'
import { CreateSelectorOptionHandler, RenameSelectorOptionHandler } from '../../hooks/useSelectorOptionRename'

interface DatabaseWeekViewProps {
	dateField: ColumnSchema
	visibleColumns: ColumnSchema[]
	manager: DatabaseManager
	weekDays: Date[]
	rowsByDate: RowsByDate
	today: Date
	nowMinutes: number
	bodyRef: React.RefObject<HTMLDivElement>
	onDayClick: DayClickHandler
	onCardDragStart: CardDragHandler
	onDayDragOver: DayDragOverHandler
	onDayDragLeave: DayDragLeaveHandler
	onDayDrop: DayDropHandler
	onOpenRow: (row: NoteRow) => void
	onCardContextMenu: CardContextMenuHandler
	onRenameOption: RenameSelectorOptionHandler
	onCreateOption: CreateSelectorOptionHandler
}

export function DatabaseWeekView({
	dateField, visibleColumns, manager, weekDays, rowsByDate, today, nowMinutes, bodyRef, onDayClick,
	onCardDragStart, onDayDragOver, onDayDragLeave, onDayDrop, onOpenRow, onCardContextMenu,
	onRenameOption, onCreateOption,
}: DatabaseWeekViewProps) {
	const isToday = (date: Date) => date.getFullYear() === today.getFullYear()
		&& date.getMonth() === today.getMonth() && date.getDate() === today.getDate()
	const hasToday = weekDays.some(isToday)

	return <div className="nb-cal-week-container">
		<div className="nb-cal-week-allday">
			<div className="nb-cal-week-time-gutter nb-cal-week-allday-label">{t('calendar_all_day')}</div>
			{weekDays.map(date => {
				const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate())
				const rows = (rowsByDate.get(key) ?? []).filter(row => {
					const parsed = parseDateValue((row as Record<string, unknown>)[dateField.id])
					return !parsed || parsed.hour === undefined
				})
				return <div key={key} className="nb-cal-week-allday-cell"
					onClick={() => { void onDayClick(date.getFullYear(), date.getMonth(), date.getDate()) }}
					onDragOver={event => onDayDragOver(event, date.getDate())}
					onDragLeave={onDayDragLeave}
					onDrop={event => { void onDayDrop(event, date.getFullYear(), date.getMonth(), date.getDate()) }}>
					{rows.map(row => <div key={row._file.path} className="nb-cal-card nb-cal-card--allday" draggable
						onDragStart={event => onCardDragStart(event, row)}
						onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onCardContextMenu(event, row) }}
						onClick={event => { event.stopPropagation(); onOpenRow(row) }}>
						<EditableTitle title={row._title} file={row._file} manager={manager} onOpen={() => onOpenRow(row)} className="nb-cal-card-title" />
						<EditableCardProperties row={row} columns={visibleColumns} manager={manager}
							onRenameOption={onRenameOption} onCreateOption={onCreateOption} />
					</div>)}
				</div>
			})}
		</div>
		<div className="nb-cal-week-header">
			<div className="nb-cal-week-time-gutter" />
			{weekDays.map(date => <div key={date.toISOString()}
				className={`nb-cal-week-day-header${isToday(date) ? ' nb-cal-week-day-header--today' : ''}`}>
				{daysShort()[(date.getDay() + 6) % 7]} {date.getDate()}
			</div>)}
		</div>
		<div className="nb-cal-week-body" ref={bodyRef}>
			{hasToday && <div className="nb-cal-now-line" style={{ top: `${(nowMinutes / 1440) * 48 * 24}px` }} />}
			<div className="nb-cal-week-time-gutter">
				{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="nb-cal-week-hour-label">{formatTime(hour, 0)}</div>)}
			</div>
			{weekDays.map(date => {
				const key = dateKey(date.getFullYear(), date.getMonth(), date.getDate())
				const rows = (rowsByDate.get(key) ?? []).filter(row => {
					const parsed = parseDateValue((row as Record<string, unknown>)[dateField.id])
					return parsed && parsed.hour !== undefined
				})
				return <div key={key} className={`nb-cal-week-day-col${isToday(date) ? ' nb-cal-week-day-col--today' : ''}`}
					onClick={() => { void onDayClick(date.getFullYear(), date.getMonth(), date.getDate()) }}
					onDragOver={event => onDayDragOver(event, date.getDate())} onDragLeave={onDayDragLeave}
					onDrop={event => { void onDayDrop(event, date.getFullYear(), date.getMonth(), date.getDate()) }}>
					{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="nb-cal-week-hour-slot" />)}
					{rows.map(row => {
						const parsed = parseDateValue((row as Record<string, unknown>)[dateField.id])
						if (!parsed || parsed.hour === undefined || parsed.minute === undefined) return null
						return <div key={row._file.path} className="nb-cal-card nb-cal-card--timed" draggable
							onDragStart={event => onCardDragStart(event, row)}
							onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onCardContextMenu(event, row) }}
							onClick={event => { event.stopPropagation(); onOpenRow(row) }}
							style={{ top: `${((parsed.hour * 60 + parsed.minute) / 1440) * 100}%` }}>
							<div className="nb-cal-card-title-row"><span className="nb-cal-time-badge">{formatTime(parsed.hour, parsed.minute)}</span><EditableTitle title={row._title} file={row._file} manager={manager} onOpen={() => onOpenRow(row)} className="nb-cal-card-title" /></div>
							<EditableCardProperties row={row} columns={visibleColumns} manager={manager}
								onRenameOption={onRenameOption} onCreateOption={onCreateOption} />
						</div>
					})}
				</div>
			})}
		</div>
	</div>
}
