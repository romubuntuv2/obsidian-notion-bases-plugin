import React, { useEffect, useRef, useState } from 'react'
import { ColumnSchema } from '../types'
import { getColumnIconStatic } from './filter-utils'
import { t } from '../i18n'

interface SharedColumnHeaderProps {
	column: ColumnSchema
	onRename: (name: string) => Promise<void>
	onHide: () => Promise<void>
	onDetach: () => Promise<void>
	onDelete: () => void
}

export function SharedColumnHeader({ column, onRename, onHide, onDetach, onDelete }: SharedColumnHeaderProps) {
	const [menuOpen, setMenuOpen] = useState(false)
	const [renaming, setRenaming] = useState(false)
	const [name, setName] = useState(column.name)
	const rootRef = useRef<HTMLDivElement>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	useEffect(() => { if (!renaming) setName(column.name) }, [column.name, renaming])
	useEffect(() => {
		if (!renaming) return
		inputRef.current?.focus()
		inputRef.current?.select()
	}, [renaming])
	useEffect(() => {
		if (!menuOpen) return
		const close = (event: MouseEvent) => {
			if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false)
		}
		activeDocument.addEventListener('mousedown', close)
		return () => activeDocument.removeEventListener('mousedown', close)
	}, [menuOpen])

	const commitRename = async () => {
		const trimmed = name.trim()
		if (trimmed && trimmed !== column.name) await onRename(trimmed)
		setRenaming(false)
		setMenuOpen(false)
	}

	return <div className="nb-column-header" ref={rootRef}>
		{renaming ? <input
			ref={inputRef}
			className="nb-header-rename-input"
			value={name}
			onChange={event => setName(event.target.value)}
			onBlur={() => { void commitRename() }}
			onKeyDown={event => {
				if (event.key === 'Enter') { event.preventDefault(); void commitRename() }
				if (event.key === 'Escape') { setRenaming(false); setMenuOpen(false) }
			}}
			onClick={event => event.stopPropagation()}
		/> : <button className="nb-header-label" onClick={() => setMenuOpen(open => !open)} title={column.name}>
			<span className="nb-header-icon">{getColumnIconStatic(column.type)}</span>
			<span className="nb-header-name">{column.name}</span>
			<span aria-label={t('shared_property_badge')} title={t('shared_property_badge')}>🔗</span>
		</button>}

		{menuOpen && !renaming && <div className="nb-column-menu">
			<div className="nb-menu-label">{t('shared_property_badge')}</div>
			<button className="nb-menu-item" onClick={() => { setMenuOpen(false); setRenaming(true) }}>
				<span className="nb-menu-item-icon">✏️</span><span>{t('rename_column')}</span>
			</button>
			<button className="nb-menu-item" onClick={() => { void onHide(); setMenuOpen(false) }}>
				<span className="nb-menu-item-icon">👁</span><span>{t('hide_field')}</span>
			</button>
			<div className="nb-menu-separator" />
			<button className="nb-menu-item nb-menu-item--danger" onClick={() => { void onDetach(); setMenuOpen(false) }}>
				<span className="nb-menu-item-icon">🔗</span><span>{t('shared_property_detach')}</span>
			</button>
			<button className="nb-menu-item nb-menu-item--danger" onClick={() => { onDelete(); setMenuOpen(false) }}>
				<span className="nb-menu-item-icon">🗑</span><span>{t('shared_property_delete_menu')}</span>
			</button>
		</div>}
	</div>
}
