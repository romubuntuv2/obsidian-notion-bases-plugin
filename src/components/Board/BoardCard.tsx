import React from 'react'
import { TFile } from 'obsidian'
import { ColumnSchema, NoteRow } from '../../types'
import { DatabaseManager } from '../../database-manager'
import EditableTitle from '../EditableFields/EditableTitle'
import EditableCardProperties from '../EditableFields/EditableCardProperties'
import { CreateSelectorOptionHandler, RenameSelectorOptionHandler } from '../../hooks/useSelectorOptionRename'

interface BoardCardProps {
	row: NoteRow
	visibleColumns: ColumnSchema[]
	manager: DatabaseManager
	onOpen: (file: TFile) => void
	onDragStart: (event: React.DragEvent, filePath: string) => void
	onContextMenu: (event: React.MouseEvent, file: TFile) => void
	onRenameOption: RenameSelectorOptionHandler
	onCreateOption: CreateSelectorOptionHandler
	cardStyle?: React.CSSProperties
}

export const BoardCard = React.memo(function BoardCard({ row, visibleColumns,
	manager, onOpen, onDragStart,
	onContextMenu, onRenameOption, onCreateOption, cardStyle }: BoardCardProps) {
	return <div className="nb-board-card" style={cardStyle} draggable
		onDragStart={event => { event.stopPropagation(); onDragStart(event, row._file.path) }}
		onContextMenu={event => { event.preventDefault(); onContextMenu(event, row._file) }}>
		<EditableTitle title={row._title} file={row._file} onOpen={onOpen}
			manager={manager} className="nb-board-card-title" />
		<EditableCardProperties row={row} columns={visibleColumns} manager={manager}
			onRenameOption={onRenameOption} onCreateOption={onCreateOption} />
	</div>
})
