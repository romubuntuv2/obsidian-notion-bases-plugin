import React from 'react'
import { TFile } from 'obsidian'
import { ColumnSchema, NoteRow, ViewConfig } from '../../types'
import { DatabaseManager } from '../../database-manager'
import { getCardConditionalStyle } from '../filter-utils'
import EditableTitle from '../EditableTitle'
import { stringifyScalar } from '../../value-utils'
import { getRowTime } from './calendar-utils'
import { CardDragHandler } from './calendar-types'

interface DatabaseMonthlyCardProps {
	row: NoteRow
	dbFile: TFile
	manager: DatabaseManager
	activeView: ViewConfig
	dateField: ColumnSchema
	schema: ColumnSchema[]
	visibleColumns: ColumnSchema[]
	onOpenFile: (file: TFile) => void
	onCardDragStart: CardDragHandler
}

export function DatabaseMonthlyCard({ row, dbFile, manager, activeView, dateField, schema,
	visibleColumns, onOpenFile, onCardDragStart }: DatabaseMonthlyCardProps) {
	const fileFolder = row._file.parent?.path ?? ''
	const databaseFolder = dbFile.parent?.path ?? ''
	const relativePath = activeView.includeSubfolders && fileFolder.length > databaseFolder.length
		? fileFolder.slice(databaseFolder.length + 1) : ''
	const cardStyle = activeView.conditionalFormats?.length
		? getCardConditionalStyle(row, activeView.conditionalFormats, schema) : undefined

	return <div className="nb-board-card nb-cal-monthly-card" style={cardStyle} draggable
		onDragStart={event => { event.stopPropagation(); onCardDragStart(event, row) }}
		onClick={event => event.stopPropagation()}>
		<div className="nb-board-card-title">
			{getRowTime(row, dateField.id) && <span className="nb-cal-time-badge">{getRowTime(row, dateField.id)}</span>}
			<EditableTitle title={row._title} file={row._file} manager={manager} onOpen={onOpenFile} className="nb-cal-card-title" />
		</div>
		{relativePath && <div className="nb-folder-path">{relativePath}</div>}
		{visibleColumns.length > 0 && <div className="nb-board-card-props">
			{visibleColumns.map(column => {
				const value = row[column.id]
				if (value === null || value === undefined || stringifyScalar(value).trim() === '') return null
				const display = Array.isArray(value) ? (value as string[]).join(', ') : stringifyScalar(value)
				return <span key={column.id} className="nb-board-card-prop">
					<span className="nb-board-card-prop-name">{column.name}:</span>
					<span className="nb-board-card-prop-value">{display}</span>
				</span>
			})}
		</div>}
	</div>
}
