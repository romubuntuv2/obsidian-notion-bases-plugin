import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Notice, TFile } from 'obsidian'
import { DatabaseManager } from '../../database-manager'
import { ColumnSchema, InlineFieldMeta, SelectOption } from '../../types'
import { t } from '../../i18n'
import {
	ColorSelectorOptionHandler, CreateSelectorOptionHandler, DeleteSelectorOptionHandler, RenameSelectorOptionHandler,
} from '../../hooks/useSelectorOptionRename'
import { RenamableSelectorOption } from './RenamableSelectorOption'
import { SelectorOptionCreateInput } from './SelectorOptionCreateInput'
import { SelectorOptionColorPicker } from './SelectorOptionColorPicker'

interface EditableSelectorProps {
	column: ColumnSchema
	value: unknown
	file: TFile
	manager: DatabaseManager
	inlineFields?: Record<string, InlineFieldMeta>
	onRenameOption: RenameSelectorOptionHandler
	onCreateOption: CreateSelectorOptionHandler
	onColorOption: ColorSelectorOptionHandler
	onDeleteOption: DeleteSelectorOptionHandler
}

const defaultStatusOptions = (): SelectOption[] => [
	{ value: t('status_not_started'), color: '#9E9E9E' },
	{ value: t('status_in_progress'), color: '#2196F3' },
	{ value: t('status_done'), color: '#4CAF50' },
	{ value: t('status_cancelled'), color: '#F44336' },
]

function textColor(background?: string): string | undefined {
	if (!background?.startsWith('#') || background.length !== 7) return undefined
	const red = parseInt(background.slice(1, 3), 16)
	const green = parseInt(background.slice(3, 5), 16)
	const blue = parseInt(background.slice(5, 7), 16)
	return (red * 299 + green * 587 + blue * 114) / 1000 > 150 ? '#111' : '#fff'
}

export default function EditableSelector({
	column, value, file, manager, inlineFields, onRenameOption, onCreateOption, onColorOption, onDeleteOption,
}: EditableSelectorProps) {
	const [open, setOpen] = useState(false)
	const [localValue, setLocalValue] = useState<unknown>(value)
	const [saving, setSaving] = useState(false)
	const [localColors, setLocalColors] = useState<Record<string, string>>({})
	const anchorRef = useRef<HTMLButtonElement>(null)
	const dropdownRef = useRef<HTMLDivElement>(null)
	const [position, setPosition] = useState({ top: 0, left: 0, width: 180 })
	const isMulti = column.type === 'multiselect'
	const baseOptions = useMemo(() => column.options?.length
		? column.options
		: column.type === 'status' ? defaultStatusOptions() : [], [column.options, column.type])
	const options = useMemo(() => baseOptions.map(option => localColors[option.value]
		? { ...option, color: localColors[option.value] }
		: option), [baseOptions, localColors])
	const selected = isMulti
		? (Array.isArray(localValue) ? localValue.filter((item): item is string => typeof item === 'string') : [])
		: (typeof localValue === 'string' ? [localValue] : [])

	useEffect(() => { setLocalValue(value) }, [value])

	useEffect(() => {
		if (!open) return
		const anchor = anchorRef.current
		if (anchor) {
			const rect = anchor.getBoundingClientRect()
			const width = Math.max(180, rect.width)
			setPosition({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - width - 8), width })
		}
		const closeOutside = (event: MouseEvent) => {
			const target = event.target as Node
			if (!anchorRef.current?.contains(target) && !dropdownRef.current?.contains(target)) setOpen(false)
		}
		activeDocument.addEventListener('mousedown', closeOutside)
		return () => activeDocument.removeEventListener('mousedown', closeOutside)
	}, [open])

	const save = async (nextValue: unknown, close: boolean) => {
		const previous = localValue
		setLocalValue(nextValue)
		if (close) setOpen(false)
		setSaving(true)
		try {
			await manager.updateNoteField(file, column.id, nextValue, inlineFields)
		} catch (error) {
			console.error(error)
			setLocalValue(previous)
			new Notice('Unable to update field')
		} finally {
			setSaving(false)
		}
	}

	const selectOption = (option: string) => {
		if (!isMulti) { void save(option, true); return }
		const next = selected.includes(option) ? selected.filter(item => item !== option) : [...selected, option]
		void save(next, false)
	}

	const createOption = async (name: string) => {
		const option = await onCreateOption(column, name, options)
		if (isMulti) {
			await save(selected.includes(option.value) ? selected : [...selected, option.value], false)
		} else {
			await save(option.value, true)
		}
	}

	const changeColor = async (optionValue: string, color: string) => {
		const previousColor = options.find(option => option.value === optionValue)?.color
		setLocalColors(current => ({ ...current, [optionValue]: color }))
		try {
			await onColorOption(column, optionValue, color, options)
		} catch {
			setLocalColors(current => ({ ...current, [optionValue]: previousColor ?? '#9E9E9E' }))
		}
	}

	const deleteOption = async (optionValue: string) => {
		try {
			await onDeleteOption(column, optionValue, options)
			if (column.propertyScope !== 'shared' && selected.includes(optionValue)) {
				setLocalValue(isMulti ? selected.filter(item => item !== optionValue) : null)
			}
			setOpen(false)
		} catch {
			// The shared action hook owns the user-facing error message.
		}
	}

	const renderBadge = (optionValue: string) => {
		const option = options.find(item => item.value === optionValue)
		return <span key={optionValue} className="nb-select-badge"
			style={{ background: option?.color, color: textColor(option?.color) }}>{optionValue}</span>
	}

	const dropdown = open ? createPortal(
		<div ref={dropdownRef} className="nb-select-dropdown nb-editable-selector-dropdown"
			style={{ position: 'fixed', top: position.top, left: position.left, minWidth: position.width, zIndex: 9999 }}
			onClick={event => event.stopPropagation()}>
			<SelectorOptionCreateInput existingValues={options.map(option => option.value)} disabled={saving}
				onCreate={createOption} onCancel={() => setOpen(false)} />
			<button className="nb-select-option nb-select-clear" disabled={saving}
				onClick={() => { void save(isMulti ? [] : null, !isMulti) }}>{t('select_clear')}</button>
			{options.map(option => <div key={option.value}
				className={`nb-select-option-row${selected.includes(option.value) ? ' nb-select-option-row--active' : ''}`}>
				<RenamableSelectorOption
					className={`nb-select-option${selected.includes(option.value) ? ' nb-select-option--active' : ''}`}
					value={option.value} disabled={saving} onSelect={() => selectOption(option.value)}
					onRename={async newValue => {
						await onRenameOption(column, option.value, newValue, options)
						setOpen(false)
					}}>
					{renderBadge(option.value)}
					{selected.includes(option.value) && <span aria-hidden="true"> ✓</span>}
				</RenamableSelectorOption>
				<SelectorOptionColorPicker color={option.color ?? '#9E9E9E'}
					onChange={color => changeColor(option.value, color)} />
				<button className="nb-select-option-delete" title={t('select_clear')}
					onClick={event => { event.stopPropagation(); void deleteOption(option.value) }}>×</button>
			</div>)}
			{options.length === 0 && <div className="nb-select-option nb-editable-selector-empty">—</div>}
		</div>, activeDocument.body
	) : null

	return <>
		<button ref={anchorRef} type="button"
			className={`nb-editable-selector ${selected.length > 0 ? 'nb-editable-selector--has-value' : 'nb-editable-selector--empty'}${open ? ' nb-editable-selector--open' : ''}`}
			draggable={false}
			disabled={saving}
			onMouseDown={event => event.stopPropagation()}
			onClick={event => { event.stopPropagation(); setOpen(current => !current) }}>
			{selected.length > 0 ? selected.map(renderBadge) : <span className="nb-cell-empty">—</span>}
		</button>
		{dropdown}
	</>
}
