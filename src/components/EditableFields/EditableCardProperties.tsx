import React from 'react'
import { DatabaseManager } from '../../database-manager'
import { ColumnSchema, NoteRow } from '../../types'
import { stringifyScalar } from '../../value-utils'
import EditableDate from './EditableDate'
import EditableSelector from './EditableSelector'

interface EditableCardPropertiesProps {
	row: NoteRow
	columns: ColumnSchema[]
	manager: DatabaseManager
}

export default function EditableCardProperties({ row, columns, manager }: EditableCardPropertiesProps) {
	if (columns.length === 0) return null

	return <div className="nb-board-card-props nb-board-card-props--inline">
		{columns.map(column => {
			const value = row[column.id]
			if (column.type === 'date' && !column.systemField) {
				return <EditableDate key={column.id} fieldId={column.id} value={value}
					file={row._file} manager={manager} inlineFields={row._inlineFields} />
			}
			const isSelector = column.type === 'select' || column.type === 'status' || column.type === 'multiselect'
			if (isSelector) {
				return <EditableSelector key={column.id} column={column} value={value}
					file={row._file} manager={manager} inlineFields={row._inlineFields} />
			}
			if (value === null || value === undefined || stringifyScalar(value).trim() === '') return null
			const display = Array.isArray(value) ? (value as string[]).join(', ') : stringifyScalar(value)
			return <span key={column.id} className="nb-board-card-prop">
				<span className="nb-board-card-prop-name">{column.name}:</span>
				<span className="nb-board-card-prop-value">{display}</span>
			</span>
		})}
	</div>
}
