import { App, Modal, Notice } from 'obsidian'
import { DatabaseManager } from './database-manager'
import { ColumnSchema, SharedPropertyDefinition } from './types'
import { SharedOptionRemovalMode } from './shared-properties'
import { t } from './i18n'

interface SharedOptionDeleteModalOptions {
	column: ColumnSchema
	optionValue: string
	onComplete?: () => void
}

export class SharedOptionDeleteModal extends Modal {
	private busy = false

	constructor(app: App, private manager: DatabaseManager, private options: SharedOptionDeleteModalOptions) {
		super(app)
	}

	onOpen(): void {
		void this.renderImpact()
	}

	private async renderImpact(): Promise<void> {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: t('shared_option_delete_title') })
		contentEl.createEl('p', { text: t('shared_delete_loading') })
		try {
			const sharedId = this.options.column.sharedPropertyId
			if (!sharedId) throw new Error('missing-shared-property')
			const impacts = await this.manager.getSharedOptionImpacts(sharedId, this.options.optionValue)
			contentEl.empty()
			contentEl.createEl('h2', { text: t('shared_option_delete_title') })
			contentEl.createEl('p', {
				text: t('shared_option_delete_summary')
					.replace('$option', this.options.optionValue)
					.replace('$count', String(impacts.length)),
			})
			this.renderChoices(this.options.column, impacts.length)
		} catch {
			contentEl.empty()
			contentEl.createEl('p', { text: t('shared_delete_error') })
		}
	}

	private renderChoices(column: ColumnSchema, impactCount: number): void {
		const { contentEl } = this
		const replacementOptions = (column.options ?? []).filter(option => option.value !== this.options.optionValue)
		const replaceSection = contentEl.createDiv({ cls: 'nb-db-settings-arrangement' })
		replaceSection.createEl('h3', { text: t('shared_option_replace_title') })
		replaceSection.createEl('p', { text: t('shared_option_replace_desc') })
		const replaceRow = replaceSection.createDiv({ cls: 'nb-arr-add-row' })
		const select = replaceRow.createEl('select', { cls: 'nb-arr-select' })
		select.createEl('option', { text: t('shared_option_replace_placeholder'), value: '' })
		for (const option of replacementOptions) select.createEl('option', { text: option.value, value: option.value })
		const replaceButton = replaceRow.createEl('button', { text: t('shared_option_replace_action'), cls: 'mod-cta nb-arr-add-btn' })
		replaceButton.disabled = replacementOptions.length === 0
		replaceButton.onclick = () => { if (select.value) void this.execute('replace', select.value) }

		const actions = contentEl.createDiv({ cls: 'nb-quick-add-buttons' })
		const cancel = actions.createEl('button', { text: t('cancel') })
		cancel.onclick = () => this.close()
		const preserve = actions.createEl('button', { text: t('shared_option_preserve_action') })
		preserve.title = t('shared_option_preserve_desc')
		preserve.onclick = () => { void this.execute('preserve') }
		const clear = actions.createEl('button', { text: t('shared_option_clear_action'), cls: 'mod-warning' })
		clear.title = impactCount > 0 ? t('shared_option_clear_desc') : ''
		clear.onclick = () => { void this.execute('clear') }
	}

	private async execute(mode: SharedOptionRemovalMode, replacement?: string): Promise<void> {
		if (this.busy || !this.options.column.sharedPropertyId) return
		this.busy = true
		try {
			const count = await this.manager.removeSharedOption(
				this.options.column.sharedPropertyId,
				this.options.optionValue,
				mode,
				replacement,
			)
			new Notice(t('shared_option_delete_success').replace('$count', String(count)))
			this.options.onComplete?.()
			this.close()
		} catch {
			new Notice(t('shared_delete_error'))
			this.busy = false
		}
	}

	onClose(): void { this.contentEl.empty() }
}

interface SharedPropertyDeleteModalOptions {
	definition: SharedPropertyDefinition
	onComplete?: () => void
}

export class SharedPropertyDeleteModal extends Modal {
	private busy = false

	constructor(app: App, private manager: DatabaseManager, private options: SharedPropertyDeleteModalOptions) {
		super(app)
	}

	onOpen(): void { void this.renderImpact() }

	private async renderImpact(): Promise<void> {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: t('shared_property_delete_title') })
		contentEl.createEl('p', { text: t('shared_delete_loading') })
		try {
			const impact = await this.manager.getSharedPropertyDeletionImpact(this.options.definition.id)
			contentEl.empty()
			contentEl.createEl('h2', { text: t('shared_property_delete_title') })
			contentEl.createEl('p', {
				text: t('shared_property_delete_summary')
					.replace('$property', impact.definition.name)
					.replace('$databases', String(impact.databases.length))
					.replace('$notes', String(impact.notesWithValues)),
			})
			contentEl.createEl('p', { text: t('shared_property_delete_conversion'), cls: 'nb-db-settings-arrangement-desc' })
			if (impact.databases.length > 0) {
				const list = contentEl.createEl('ul')
				for (const database of impact.databases) list.createEl('li', { text: database.file.path })
			}
			const actions = contentEl.createDiv({ cls: 'nb-quick-add-buttons' })
			const cancel = actions.createEl('button', { text: t('cancel') })
			cancel.onclick = () => this.close()
			const confirm = actions.createEl('button', { text: t('shared_property_delete_action'), cls: 'mod-warning' })
			confirm.onclick = () => { void this.execute() }
		} catch {
			contentEl.empty()
			contentEl.createEl('p', { text: t('shared_delete_error') })
		}
	}

	private async execute(): Promise<void> {
		if (this.busy) return
		this.busy = true
		try {
			await this.manager.deleteSharedProperty(this.options.definition.id)
			new Notice(t('shared_property_delete_success'))
			this.options.onComplete?.()
			this.close()
		} catch {
			new Notice(t('shared_delete_error'))
			this.busy = false
		}
	}

	onClose(): void { this.contentEl.empty() }
}
