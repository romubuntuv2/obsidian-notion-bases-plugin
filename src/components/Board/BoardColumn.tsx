import React, { Fragment } from 'react'
import { TFile } from 'obsidian'
import { ColumnSchema, ViewConfig } from '../../types'
import { DatabaseManager } from '../../database-manager'
import { getCardConditionalStyle } from '../filter-utils'
import { t } from '../../i18n'
import { BoardCard } from './BoardCard'
import { LazyBoardCard } from './LazyBoardCard'
import { BoardColumnData, DRAG_TYPE_CARD, DRAG_TYPE_COLUMN, VIRTUALIZATION_THRESHOLD } from './board-types'
import {
	ColorSelectorOptionHandler, CreateSelectorOptionHandler, DeleteSelectorOptionHandler, RenameSelectorOptionHandler,
} from '../../hooks/useSelectorOptionRename'

interface BoardColumnProps {
	column: BoardColumnData
	cardDragOver: string | null
	columnDragOver: string | null
	view: ViewConfig
	schema: ColumnSchema[]
	visibleColumns: ColumnSchema[]
	manager: DatabaseManager
	editingLimit: string | null
	expanded: boolean
	onSetEditingLimit: (value: string | null) => void
	onSetExpanded: (expanded: boolean) => void
	onSetCardDragOver: (value: string | null) => void
	onSetColumnDragOver: (value: string | null) => void
	onSaveView: (view: ViewConfig) => Promise<void>
	onMoveCard: (rowPath: string, targetValue: string) => Promise<void>
	onMoveColumn: (fromValue: string, toValue: string) => Promise<void>
	onAddCard: (columnValue: string) => Promise<void>
	onOpenFile: (file: TFile) => void
	onCardDragStart: (event: React.DragEvent, filePath: string) => void
	onCardContextMenu: (event: React.MouseEvent, file: TFile) => void
	onRenameOption: RenameSelectorOptionHandler
	onCreateOption: CreateSelectorOptionHandler
	onColorOption: ColorSelectorOptionHandler
	onDeleteOption: DeleteSelectorOptionHandler
}

export function BoardColumn({ column, cardDragOver, columnDragOver, view, schema,
	visibleColumns, manager, editingLimit, expanded,
	onSetEditingLimit, onSetExpanded, onSetCardDragOver, onSetColumnDragOver,
	onSaveView, onMoveCard, onMoveColumn, onAddCard, onOpenFile, onCardDragStart,
	onCardContextMenu, onRenameOption, onCreateOption, onColorOption, onDeleteOption }: BoardColumnProps) {
	const key = column.value || '__no_value__'
	const limit = view.boardColumnLimits?.[column.value]
	const overLimit = limit !== undefined && limit > 0 && column.rows.length >= limit
	const visibleRows = limit && limit > 0 && !expanded ? column.rows.slice(0, limit) : column.rows
	const hiddenCount = column.rows.length - visibleRows.length

	const saveLimit = (rawValue: string) => {
		const value = parseInt(rawValue)
		const limits = { ...view.boardColumnLimits }
		if (isNaN(value) || value <= 0) delete limits[column.value]
		else limits[column.value] = value
		void onSaveView({ ...view, boardColumnLimits: limits })
		onSetEditingLimit(null)
	}

	return <div data-col-key={key}
		className={`nb-board-column${cardDragOver === key ? ' nb-board-column--card-over' : ''}${columnDragOver === key ? ' nb-board-column--col-over' : ''}${overLimit ? ' nb-board-column--over-limit' : ''}`}
		onDragOver={event => {
			event.preventDefault()
			if (event.dataTransfer.types.includes(DRAG_TYPE_CARD)) onSetCardDragOver(key)
			else onSetColumnDragOver(key)
		}}
		onDragLeave={event => {
			if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
				onSetCardDragOver(null); onSetColumnDragOver(null)
			}
		}}
		// eslint-disable-next-line @typescript-eslint/no-misused-promises -- async drop persists card/column order
		onDrop={async event => {
			event.preventDefault(); onSetCardDragOver(null); onSetColumnDragOver(null)
			const dragType = event.dataTransfer.getData('nb-drag-type')
			if (dragType === DRAG_TYPE_CARD) {
				const rowPath = event.dataTransfer.getData('nb-row-path')
				if (rowPath) await onMoveCard(rowPath, column.value)
			} else if (dragType === DRAG_TYPE_COLUMN) {
				await onMoveColumn(event.dataTransfer.getData('nb-col-value'), column.value)
			}
		}}>
		<div className="nb-board-column-header" draggable
			onDragStart={event => {
				event.stopPropagation(); event.dataTransfer.effectAllowed = 'move'
				event.dataTransfer.setData('nb-drag-type', DRAG_TYPE_COLUMN)
				event.dataTransfer.setData('nb-col-value', column.value)
				event.dataTransfer.setData(DRAG_TYPE_COLUMN, '')
			}}
			onDragEnd={() => onSetColumnDragOver(null)} title={t('board_drag_reorder')}>
			<span className="nb-board-column-drag-handle">⠿</span>
			{column.color
				? <span className="nb-board-column-badge" style={{ background: column.color }}>{column.label}</span>
				: <span className="nb-board-column-name">{column.label}</span>}
			<span className={`nb-board-column-count ${overLimit ? 'nb-board-column-count--over' : ''}`}
				onClick={event => { event.stopPropagation(); onSetEditingLimit(editingLimit === column.value ? null : column.value) }}
				title={t('board_set_limit')}>
				{limit && limit > 0 ? `${column.rows.length}/${limit}` : column.rows.length}
			</span>
		</div>
		{editingLimit === column.value && <div className="nb-board-limit-input-wrapper">
			<input className="nb-board-limit-input" type="number" min="0"
				placeholder={t('board_limit_placeholder')} defaultValue={limit ?? ''} autoFocus
				onKeyDown={event => { if (event.key === 'Enter' || event.key === 'Escape') saveLimit((event.target as HTMLInputElement).value) }}
				onBlur={event => saveLimit(event.target.value)} />
		</div>}
		<div className="nb-board-cards">
			{visibleRows.map(row => {
				const card = <BoardCard row={row} visibleColumns={visibleColumns}
					manager={manager} onOpen={onOpenFile}
					onDragStart={onCardDragStart} onContextMenu={onCardContextMenu}
					onRenameOption={onRenameOption} onCreateOption={onCreateOption}
					onColorOption={onColorOption} onDeleteOption={onDeleteOption}
					cardStyle={view.conditionalFormats?.length ? getCardConditionalStyle(row, view.conditionalFormats, schema) : undefined} />
				return visibleRows.length >= VIRTUALIZATION_THRESHOLD
					? <LazyBoardCard key={row._file.path}>{card}</LazyBoardCard>
					: <Fragment key={row._file.path}>{card}</Fragment>
			})}
			{hiddenCount > 0 && <button className="nb-board-show-more" onClick={() => onSetExpanded(true)}>{`+${hiddenCount} ${t('board_show_more')}`}</button>}
			{expanded && limit && limit > 0 && column.rows.length > limit && <button className="nb-board-show-more" onClick={() => onSetExpanded(false)}>{t('board_show_less')}</button>}
		</div>
		<button className="nb-board-add-card" onClick={() => { void onAddCard(column.value) }}>{'+ ' + t('add_card')}</button>
	</div>
}
