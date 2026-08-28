import React, { useState } from 'react'
import { Notice } from 'obsidian'
import { t } from '../../i18n'

interface SelectorOptionCreateInputProps {
	disabled?: boolean
	existingValues: string[]
	onCreate: (name: string) => Promise<void>
	onCancel?: () => void
}

export function SelectorOptionCreateInput({ existingValues, disabled, onCreate, onCancel }: SelectorOptionCreateInputProps) {
	const [draft, setDraft] = useState('')
	const [saving, setSaving] = useState(false)

	const create = async () => {
		const trimmed = draft.trim()
		if (!trimmed || saving) return
		if (existingValues.includes(trimmed)) {
			new Notice(t('selector_option_duplicate'))
			return
		}
		setSaving(true)
		try {
			await onCreate(trimmed)
			setDraft('')
		} catch {
			// The owning action displays the contextual error and keeps the draft editable.
		} finally {
			setSaving(false)
		}
	}

	return <input
		className="nb-select-new-input"
		type="text"
		placeholder={t('select_create_placeholder')}
		value={draft}
		autoFocus
		disabled={disabled || saving}
		onMouseDown={event => event.stopPropagation()}
		onClick={event => event.stopPropagation()}
		onChange={event => setDraft(event.target.value)}
		onKeyDown={event => {
			event.stopPropagation()
			if (event.key === 'Enter') { event.preventDefault(); void create() }
			if (event.key === 'Escape') { event.preventDefault(); onCancel?.() }
		}}
	/>
}
