import React from 'react'
import { TFile } from 'obsidian'
import { DatabaseManager } from '../../database-manager'
import { NoteRow, ViewConfig } from '../../types'
import { t } from '../../i18n'
import EditableTitle from '../EditableTitle'
import { CardDragHandler } from './calendar-types'

interface DatabaseNoDateRowsProps {
	rows: NoteRow[]
	dbFile: TFile
	manager: DatabaseManager
	activeView: ViewConfig
	onOpenFile: (file: TFile) => void
	onCardDragStart: CardDragHandler
}

export function DatabaseNoDateRows({ rows, dbFile, manager, activeView, onOpenFile, onCardDragStart }: DatabaseNoDateRowsProps) {
	const databaseFolder = dbFile.parent?.path ?? ''
	return <div className="nb-cal-no-date">
		<div className="nb-cal-no-date-title">{t('calendar_no_date_section')} ({rows.length})</div>
		<div className="nb-cal-no-date-list">
			{rows.map(row => {
				const fileFolder = row._file.parent?.path ?? ''
				const relativePath = activeView.includeSubfolders && fileFolder.length > databaseFolder.length
					? fileFolder.slice(databaseFolder.length + 1) : ''
				return <div key={row._file.path} className="nb-cal-card nb-cal-card--no-date" draggable
					onDragStart={event => onCardDragStart(event, row)} onClick={event => event.stopPropagation()}>
					<EditableTitle title={row._title} file={row._file} manager={manager} onOpen={onOpenFile} className="nb-cal-card-title" />
					{relativePath && <div className="nb-folder-path">{relativePath}</div>}
				</div>
			})}
		</div>
	</div>
}
