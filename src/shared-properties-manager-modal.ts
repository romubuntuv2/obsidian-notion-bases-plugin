import { App, Modal, Notice, TFile } from 'obsidian'
import { DatabaseManager } from './database-manager'
import type { SharedPropertyDeletionImpact } from './database-manager'
import type { SharedPropertyDefinition } from './types'
import { SharedPropertyEditorModal } from './shared-property-editor-modal'
import { SharedPropertyDeleteModal } from './shared-property-deletion-modals'
import { detachSharedProperty, findMissingSharedPropertyReferences } from './shared-properties'
import { t } from './i18n'

interface MissingSharedReference {
	file: TFile
	sharedPropertyId: string
}

export class SharedPropertiesManagerModal extends Modal {
	private renderVersion = 0

	constructor(app: App, private manager: DatabaseManager) {
		super(app)
	}

	onOpen(): void { void this.render() }

	private async render(): Promise<void> {
		const version = ++this.renderVersion
		const { contentEl } = this
		contentEl.empty()
		contentEl.addClass('nb-shared-manager')
		const header = contentEl.createDiv({ cls: 'nb-shared-manager-header' })
		header.createEl('h2', { text: t('shared_manager_title') })
		const createButton = header.createEl('button', { text: t('shared_property_create'), cls: 'mod-cta' })
		createButton.onclick = () => { void this.openEditor() }
		contentEl.createEl('p', { text: t('shared_manager_desc'), cls: 'setting-item-description' })
		const loading = contentEl.createEl('p', { text: t('shared_manager_loading'), cls: 'setting-item-description' })

		try {
			const registry = this.manager.sharedProperties.read()
			const databases = this.manager.getAllDatabases().map(file => ({ file, config: this.manager.readConfig(file) }))
			const filesByPath = new Map(databases.map(database => [database.file.path, database.file]))
			const missingReferences: MissingSharedReference[] = findMissingSharedPropertyReferences(
				registry,
				databases.map(({ file, config }) => ({ path: file.path, sharedPropertyIds: config.sharedPropertyIds })),
			).flatMap(reference => {
				const file = filesByPath.get(reference.databasePath)
				return file ? [{ file, sharedPropertyId: reference.sharedPropertyId }] : []
			})
			const impacts = await Promise.all(registry.properties.map(property =>
				this.manager.getSharedPropertyDeletionImpact(property.id)))
			if (version !== this.renderVersion) return
			loading.remove()
			this.renderMissingReferences(missingReferences)
			this.renderProperties(impacts)
		} catch (error) {
			console.error(error)
			if (version !== this.renderVersion) return
			loading.setText(t('shared_manager_load_error'))
		}
	}

	private renderMissingReferences(references: MissingSharedReference[]): void {
		if (references.length === 0) return
		const section = this.contentEl.createDiv({ cls: 'nb-shared-manager-broken' })
		section.createEl('h3', { text: t('shared_manager_broken_title') })
		section.createEl('p', { text: t('shared_manager_broken_desc'), cls: 'setting-item-description' })
		for (const reference of references) {
			const row = section.createDiv({ cls: 'nb-shared-manager-broken-row' })
			row.createSpan({ text: `${reference.file.path} · ${reference.sharedPropertyId}` })
			const openButton = row.createEl('button', { text: t('shared_manager_open_database') })
			openButton.onclick = () => { void this.openDatabase(reference.file) }
			const cleanButton = row.createEl('button', { text: t('shared_manager_clean_reference'), cls: 'mod-warning' })
			cleanButton.onclick = () => { void this.cleanMissingReference(reference) }
		}
	}

	private renderProperties(impacts: SharedPropertyDeletionImpact[]): void {
		const section = this.contentEl.createDiv({ cls: 'nb-shared-manager-list' })
		if (impacts.length === 0) {
			section.createEl('p', { text: t('shared_manager_empty'), cls: 'setting-item-description' })
			return
		}
		for (const impact of impacts.sort((a, b) => a.definition.name.localeCompare(b.definition.name))) {
			const card = section.createDiv({ cls: 'nb-shared-manager-card' })
			const heading = card.createDiv({ cls: 'nb-shared-manager-card-heading' })
			const identity = heading.createDiv({ cls: 'nb-shared-manager-identity' })
			identity.createEl('strong', { text: impact.definition.name })
			identity.createSpan({ text: `${impact.definition.type} · ${impact.definition.storageKey}`, cls: 'setting-item-description' })
			const actions = heading.createDiv({ cls: 'nb-shared-manager-actions' })
			const editButton = actions.createEl('button', { text: t('shared_property_edit') })
			editButton.onclick = () => { void this.openEditor(impact.definition) }
			const deleteButton = actions.createEl('button', { text: t('shared_property_delete_menu'), cls: 'mod-warning' })
			deleteButton.onclick = () => this.openDelete(impact.definition)

			card.createEl('p', {
				text: t('shared_manager_usage')
					.replace('$databases', String(impact.databases.length))
					.replace('$notes', String(impact.notesWithValues)),
				cls: 'nb-shared-manager-usage',
			})
			if (impact.definition.options?.length) {
				const options = card.createDiv({ cls: 'nb-shared-manager-options' })
				for (const option of impact.definition.options) {
					const badge = options.createSpan({ text: option.value, cls: 'nb-select-badge' })
					badge.style.backgroundColor = option.color ?? 'var(--background-modifier-hover)'
				}
			}
			if (impact.databases.length === 0) {
				card.createEl('p', { text: t('shared_manager_unattached'), cls: 'setting-item-description' })
			} else {
				const databaseList = card.createDiv({ cls: 'nb-shared-manager-databases' })
				for (const database of impact.databases) {
					const button = databaseList.createEl('button', { text: database.file.path, cls: 'nb-shared-manager-database' })
					button.onclick = () => { void this.openDatabase(database.file) }
				}
			}
		}
	}

	private openEditor(definition?: SharedPropertyDefinition): void {
		const allowOptionRemoval = definition
			? !this.manager.getAllDatabases().some(file =>
				(this.manager.readConfig(file).sharedPropertyIds ?? []).includes(definition.id))
			: false
		new SharedPropertyEditorModal(this.app, {
			definition,
			allowOptionRemoval,
			onSave: async value => {
				try {
					if (definition) {
						await this.manager.sharedProperties.update(
							{ ...definition, ...value, id: definition.id },
							{ allowOptionRemoval },
						)
					} else {
						await this.manager.sharedProperties.create(value)
					}
					await this.render()
				} catch (error) {
					const message = error instanceof Error ? error.message : ''
					new Notice(message === 'duplicate-shared-property-key'
						? t('shared_property_duplicate_key')
						: message === 'shared-property-option-removal-requires-impact-scan'
							? t('shared_property_option_removal_blocked')
							: t('shared_property_invalid'))
					throw error
				}
			},
		}).open()
	}

	private openDelete(definition: SharedPropertyDefinition): void {
		new SharedPropertyDeleteModal(this.app, this.manager, {
			definition,
			onComplete: () => { void this.render() },
		}).open()
	}

	private async cleanMissingReference(reference: MissingSharedReference): Promise<void> {
		try {
			const config = this.manager.readConfig(reference.file)
			await this.manager.writeConfig(reference.file, detachSharedProperty(config, reference.sharedPropertyId))
			await this.render()
		} catch (error) {
			console.error(error)
			new Notice(t('shared_manager_clean_error'))
		}
	}

	private async openDatabase(file: TFile): Promise<void> {
		await this.app.workspace.getLeaf(false).openFile(file)
		this.close()
	}

	onClose(): void {
		this.renderVersion++
		this.contentEl.empty()
	}
}
