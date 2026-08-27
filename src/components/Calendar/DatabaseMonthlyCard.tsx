import React from 'react'
import { TFile } from 'obsidian'
import { ColumnSchema, NoteRow, ViewConfig } from '../../types'
import { DatabaseManager } from '../../database-manager'
import { getCardConditionalStyle } from '../filter-utils'
import EditableTitle from '../EditableFields/EditableTitle'
import EditableCardProperties from '../EditableFields/EditableCardProperties'
import { getRowTime } from './calendar-utils'
import { CardContextMenuHandler, CardDragHandler } from './calendar-types'

interface DatabaseMonthlyCardProps {
	row: NoteRow
	manager: DatabaseManager
	activeView: ViewConfig
	dateField: ColumnSchema
	schema: ColumnSchema[]
	visibleColumns: ColumnSchema[]
	onOpenFile: (file: TFile) => void
	onCardDragStart: CardDragHandler
	onContextMenu: CardContextMenuHandler
}

export function DatabaseMonthlyCard({ row, manager, activeView, dateField, schema,
	visibleColumns, onOpenFile, onCardDragStart, onContextMenu }: DatabaseMonthlyCardProps) {
	const cardStyle = activeView.conditionalFormats?.length
		? getCardConditionalStyle(row, activeView.conditionalFormats, schema) : undefined

	return <div className="nb-board-card nb-cal-monthly-card" style={cardStyle} draggable
		onDragStart={event => { event.stopPropagation(); onCardDragStart(event, row) }}
		onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onContextMenu(event, row) }}
		onClick={event => event.stopPropagation()}>
		<div className="nb-board-card-title">
			{getRowTime(row, dateField.id) && <span className="nb-cal-time-badge">{getRowTime(row, dateField.id)}</span>}
			<EditableTitle title={row._title} file={row._file} manager={manager} onOpen={onOpenFile} className="nb-cal-card-title" />
		</div>
		<EditableCardProperties row={row} columns={visibleColumns} manager={manager} />
	</div>
}
