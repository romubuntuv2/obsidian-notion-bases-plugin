import React from 'react'
import { TFile } from 'obsidian'
import { ColumnSchema, NoteRow } from '../../types'
import { DatabaseManager } from '../../database-manager'
import EditableTitle from '../EditableFields/EditableTitle'
import EditableCardProperties from '../EditableFields/EditableCardProperties'

interface BoardCardProps {
	row: NoteRow
	visibleColumns: ColumnSchema[]
	databaseFolderPath: string
	includeSubfolders: boolean
	manager: DatabaseManager
	onOpen: (file: TFile) => void
	onDragStart: (event: React.DragEvent, filePath: string) => void
	onContextMenu: (event: React.MouseEvent, file: TFile) => void
	cardStyle?: React.CSSProperties
}

export const BoardCard = React.memo(function BoardCard({ row, visibleColumns,
	databaseFolderPath, includeSubfolders, manager, onOpen, onDragStart,
	onContextMenu, cardStyle }: BoardCardProps) {
	const fileFolder = row._file.parent?.path ?? ''
	const relativePath = includeSubfolders && fileFolder.length > databaseFolderPath.length
		? fileFolder.slice(databaseFolderPath.length + 1) : ''

	return <div className="nb-board-card" style={cardStyle} draggable
		onDragStart={event => { event.stopPropagation(); onDragStart(event, row._file.path) }}
		onContextMenu={event => { event.preventDefault(); onContextMenu(event, row._file) }}>
		<EditableTitle title={row._title} file={row._file} onOpen={onOpen}
			manager={manager} className="nb-board-card-title" />
		{relativePath && <div className="nb-folder-path">{relativePath}</div>}
		<EditableCardProperties row={row} columns={visibleColumns} manager={manager} />
	</div>
})
