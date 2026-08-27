import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Notice, TFile } from 'obsidian'
import { DatabaseManager } from '../../database-manager'
import { InlineFieldMeta } from '../../types'

interface EditableDateProps {
	fieldId: string
	value: unknown
	file: TFile
	manager: DatabaseManager
	inlineFields?: Record<string, InlineFieldMeta>
}

const weekdays = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const months = ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.']

function datePart(value: unknown): string {
	if (typeof value !== 'string') return ''
	return value.split('T')[0]
}

function compactFrenchDate(value: unknown): string | null {
	const raw = datePart(value)
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
	if (!match) return null
	const year = Number(match[1])
	const month = Number(match[2]) - 1
	const day = Number(match[3])
	const date = new Date(year, month, day)
	if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null
	return `${weekdays[date.getDay()]} ${day} ${months[month]}`
}

export default function EditableDate({ fieldId, value, file, manager, inlineFields }: EditableDateProps) {
	const [localValue, setLocalValue] = useState<unknown>(value)
	const [saving, setSaving] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	useEffect(() => { setLocalValue(value) }, [value])

	const save = async (newDate: string) => {
		const previous = localValue
		const current = typeof localValue === 'string' ? localValue : ''
		const nextValue = newDate
			? current.includes('T') ? `${newDate}T${current.split('T')[1]}` : newDate
			: null
		setLocalValue(nextValue)
		setSaving(true)
		try {
			await manager.updateNoteField(file, fieldId, nextValue, inlineFields)
		} catch (error) {
			console.error(error)
			setLocalValue(previous)
			new Notice('Unable to update date')
		} finally {
			setSaving(false)
		}
	}

	const display = compactFrenchDate(localValue)
	const openPicker = (event: React.MouseEvent) => {
		event.preventDefault()
		event.stopPropagation()
		if (saving) return
		const input = inputRef.current
		if (!input) return
		try { input.showPicker() } catch { input.focus(); input.click() }
	}

	const nativeInput = createPortal(
		<input ref={inputRef} type="date" className="nb-editable-date-input" value={datePart(localValue)}
			disabled={saving} draggable={false} tabIndex={-1} aria-hidden="true"
			onChange={event => { void save(event.target.value) }} />,
		activeDocument.body,
	)

	return <>
		<button type="button" draggable={false}
			className={`nb-editable-date${display ? '' : ' nb-editable-date--empty'}${saving ? ' nb-editable-date--saving' : ''}`}
			disabled={saving} aria-label="Modifier la date"
			onMouseDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
			onClick={openPicker}>{display ?? '—'}</button>
		{nativeInput}
	</>
}
