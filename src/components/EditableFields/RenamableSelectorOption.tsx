import React, { ReactNode, useRef, useState } from 'react'
import { useClickOrDoubleClick } from '../../hooks/useClickOrDoubleClick'
import { t } from '../../i18n'

interface RenamableSelectorOptionProps {
	value: string
	className: string
	disabled?: boolean
	children: ReactNode
	onSelect: () => void
	onRename: (newValue: string) => Promise<void>
}

export function RenamableSelectorOption({
	value, className, disabled, children, onSelect, onRename,
}: RenamableSelectorOptionProps) {
	const [renaming, setRenaming] = useState(false)
	const [draft, setDraft] = useState(value)
	const [saving, setSaving] = useState(false)
	const inputRef = useRef<HTMLInputElement>(null)
	const clickHandlers = useClickOrDoubleClick<HTMLButtonElement>({
		onClick: onSelect,
		onDoubleClick: () => {
			setDraft(value)
			setRenaming(true)
			window.setTimeout(() => {
				inputRef.current?.focus()
				inputRef.current?.select()
			}, 0)
		},
	})

	const commit = async () => {
		if (saving) return
		const trimmed = draft.trim()
		if (!trimmed || trimmed === value) {
			setRenaming(false)
			return
		}
		setSaving(true)
		try {
			await onRename(trimmed)
			setRenaming(false)
		} catch {
			window.setTimeout(() => inputRef.current?.focus(), 0)
		} finally {
			setSaving(false)
		}
	}

	if (renaming) {
		return <div className={`${className} nb-selector-option-renaming`}
			onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
			<input ref={inputRef} className="nb-selector-option-rename-input" value={draft} disabled={saving}
				aria-label={t('selector_option_rename')}
				onChange={event => setDraft(event.target.value)}
				onBlur={() => { void commit() }}
				onKeyDown={event => {
					event.stopPropagation()
					if (event.key === 'Enter') { event.preventDefault(); void commit() }
					if (event.key === 'Escape') { event.preventDefault(); setDraft(value); setRenaming(false) }
				}}
			/>
		</div>
	}

	return <button className={className} disabled={disabled}
		title={t('selector_option_rename_hint')} {...clickHandlers}>
		{children}
	</button>
}
