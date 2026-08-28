import { App, Modal, Notice, Setting } from 'obsidian'
import { ColumnType, SelectOption, SharedPropertyDefinition } from './types'
import { SHARED_PROPERTY_TYPES } from './shared-properties'
import { t } from './i18n'

const SELECTOR_TYPES = new Set<ColumnType>(['select', 'multiselect', 'status'])

function makeStorageKey(name: string): string {
	return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
		.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '')
}

function parseOptions(value: string, previous: SelectOption[] | undefined): SelectOption[] {
	const previousColors = new Map((previous ?? []).map(option => [option.value, option.color]))
	const seen = new Set<string>()
	return value.split(/[\n,]+/).flatMap(raw => {
		const [rawValue, rawColor] = raw.split('|').map(part => part.trim())
		if (!rawValue || seen.has(rawValue)) return []
		seen.add(rawValue)
		const color = rawColor || previousColors.get(rawValue)
		return [{ value: rawValue, ...(color ? { color } : {}) }]
	})
}

interface SharedPropertyEditorModalOptions {
	definition?: SharedPropertyDefinition
	initialType?: ColumnType
	fixedType?: boolean
	showOptions?: boolean
	onSave: (definition: Omit<SharedPropertyDefinition, 'id'> & { id?: string }) => Promise<void>
}

export class SharedPropertyEditorModal extends Modal {
	private name: string
	private storageKey: string
	private type: ColumnType
	private optionsText: string
	private storageKeyEdited = false

	constructor(app: App, private editorOptions: SharedPropertyEditorModalOptions) {
		super(app)
		const definition = editorOptions.definition
		this.name = definition?.name ?? ''
		this.storageKey = definition?.storageKey ?? ''
		this.type = definition?.type ?? editorOptions.initialType ?? 'select'
		this.optionsText = (definition?.options ?? [])
			.map(option => option.color ? `${option.value} | ${option.color}` : option.value)
			.join('\n')
	}

	onOpen(): void {
		const { contentEl } = this
		contentEl.empty()
		const existing = this.editorOptions.definition
		let storageKeyInput: HTMLInputElement | null = null
		contentEl.createEl('h2', { text: existing ? t('shared_property_edit') : t('shared_property_create') })

		new Setting(contentEl)
			.setName(t('shared_property_name'))
			.addText(component => component
				.setValue(this.name)
				.onChange(value => {
					this.name = value
					if (!existing && !this.storageKeyEdited) {
						this.storageKey = makeStorageKey(value)
						if (storageKeyInput) storageKeyInput.value = this.storageKey
					}
				}))

		new Setting(contentEl)
			.setName(t('shared_property_storage_key'))
			.setDesc(existing ? t('shared_property_storage_key_locked') : t('shared_property_storage_key_desc'))
			.addText(component => {
				storageKeyInput = component.inputEl
				component.setValue(this.storageKey).onChange(value => {
					this.storageKeyEdited = true
					this.storageKey = value.trim()
				})
				if (existing) component.inputEl.disabled = true
			})

		new Setting(contentEl)
			.setName(t('shared_property_type'))
			.addDropdown(component => {
				for (const type of SHARED_PROPERTY_TYPES) component.addOption(type, type)
				component.setValue(this.type).onChange(value => {
					this.type = value as ColumnType
					this.onOpen()
				})
				if (existing || this.editorOptions.fixedType) component.selectEl.disabled = true
			})

		if (SELECTOR_TYPES.has(this.type) && this.editorOptions.showOptions !== false) {
			new Setting(contentEl)
				.setName(t('shared_property_options'))
				.setDesc(t('shared_property_options_desc'))
				.addTextArea(component => component
					.setValue(this.optionsText)
					.onChange(value => { this.optionsText = value }))
		}

		const actions = contentEl.createDiv({ cls: 'nb-quick-add-buttons' })
		const cancelButton = actions.createEl('button', { text: t('cancel') })
		cancelButton.onclick = () => this.close()
		const saveButton = actions.createEl('button', { text: t('save'), cls: 'mod-cta' })
		saveButton.onclick = () => { void this.save() }
	}

	private async save(): Promise<void> {
		if (!this.name.trim() || !this.storageKey.trim()) {
			new Notice(t('shared_property_invalid'))
			return
		}
		const existing = this.editorOptions.definition
		const nextOptions = SELECTOR_TYPES.has(this.type) ? parseOptions(this.optionsText, existing?.options) : undefined
		if (existing?.options?.some(option => !nextOptions?.some(candidate => candidate.value === option.value))) {
			new Notice(t('shared_property_option_removal_blocked'))
			return
		}
		try {
			await this.editorOptions.onSave({
				...(existing ? { id: existing.id } : {}),
				name: this.name.trim(),
				storageKey: this.storageKey.trim(),
				type: this.type,
				options: nextOptions,
			})
			this.close()
		} catch {
			// The caller owns the user-facing error message; keep the editor open.
		}
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
