import React from 'react'
import { TFile } from 'obsidian'
import { DatabaseManager } from '../../database-manager'
import { ColumnSchema, NoteRow } from '../../types'
import { t } from '../../i18n'
import EditableTitle from '../EditableFields/EditableTitle'
import EditableCardProperties from '../EditableFields/EditableCardProperties'
import { CardContextMenuHandler, CardDragHandler } from './calendar-types'
import {
	ColorSelectorOptionHandler, CreateSelectorOptionHandler, DeleteSelectorOptionHandler, RenameSelectorOptionHandler,
} from '../../hooks/useSelectorOptionRename'

interface DatabaseNoDateRowsProps {
	rows: NoteRow[]
	manager: DatabaseManager
	visibleColumns: ColumnSchema[]
	onOpenFile: (file: TFile) => void
	onCardDragStart: CardDragHandler
	onCardContextMenu: CardContextMenuHandler
	onRenameOption: RenameSelectorOptionHandler
	onCreateOption: CreateSelectorOptionHandler
	onColorOption: ColorSelectorOptionHandler
	onDeleteOption: DeleteSelectorOptionHandler
}

export function DatabaseNoDateRows({ rows, manager, visibleColumns,
	onOpenFile, onCardDragStart, onCardContextMenu, onRenameOption, onCreateOption,
	onColorOption, onDeleteOption }: DatabaseNoDateRowsProps) {
	return <div className="nb-cal-no-date">
		<div className="nb-cal-no-date-title">{t('calendar_no_date_section')} ({rows.length})</div>
		<div className="nb-cal-no-date-list">
			{rows.map(row => <div key={row._file.path} className="nb-cal-card nb-cal-card--no-date" draggable
					onDragStart={event => onCardDragStart(event, row)}
					onContextMenu={event => { event.preventDefault(); event.stopPropagation(); onCardContextMenu(event, row) }}
					onClick={event => event.stopPropagation()}>
					<EditableTitle title={row._title} file={row._file} manager={manager} onOpen={onOpenFile} className="nb-cal-card-title" />
					<EditableCardProperties row={row} columns={visibleColumns} manager={manager}
						onRenameOption={onRenameOption} onCreateOption={onCreateOption}
						onColorOption={onColorOption} onDeleteOption={onDeleteOption} />
				</div>)}
		</div>
	</div>
}
