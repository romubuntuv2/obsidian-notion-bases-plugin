import { App, Modal, Notice, Setting, TFile } from 'obsidian'
import { ColumnType, DatabaseConfig, FolderArrangementConfig, SharedPropertyDefinition } from './types'
import { TemplatePickerModal } from './template-picker-modal'
import { FolderPickerModal } from './folder-picker-modal'
import { DatabaseManager } from './database-manager'
import { FolderArrangementPreviewModal } from './folder-arrangement-preview-modal'
import { t } from './i18n'
import {
	attachSharedProperty, detachSharedProperty, getSharedPropertyAttachmentError, resolveAttachedSharedProperties,
} from './shared-properties'
import { SharedPropertyEditorModal } from './shared-property-editor-modal'
import { SharedPropertyDeleteModal } from './shared-property-deletion-modals'

const ARRANGEMENT_SUPPORTED_TYPES: ColumnType[] = ['text', 'select', 'status', 'date']

type SettingsUpdate = {
	templatePath?: string
	templateFolder?: string
	askTemplateOnCreate?: boolean
	folderArrangement?: FolderArrangementConfig
	sharedPropertyIds?: string[]
}

export class DatabaseSettingsModal extends Modal {
	private config: DatabaseConfig
	private onSave: (updated: SettingsUpdate) => Promise<void> | void
	private manager: DatabaseManager | null
	private dbFile: TFile | null
	private restrictToPaths: Set<string> | undefined

	constructor(
		app: App,
		config: DatabaseConfig,
		onSave: (updated: SettingsUpdate) => Promise<void> | void,
		manager?: DatabaseManager,
		dbFile?: TFile | null,
		restrictToPaths?: Set<string>,
	) {
		super(app)
		this.config = config
		this.onSave = onSave
		this.manager = manager ?? null
		this.dbFile = dbFile ?? null
		this.restrictToPaths = restrictToPaths
	}

	onOpen(): void {
		const { contentEl } = this
		contentEl.empty()
		contentEl.createEl('h2', { text: t('db_settings_title') })

		// ── Template path ─────────────────────────────────────────────────
		const tplSetting = new Setting(contentEl)
			.setName(t('db_settings_template_name'))
			.setDesc(t('db_settings_template_desc'))

		const pathEl = contentEl.createDiv({ cls: 'nb-db-settings-template-path' })
		const renderPath = () => {
			pathEl.empty()
			pathEl.setText(this.config.templatePath ?? t('db_settings_template_none'))
		}
		renderPath()

		tplSetting.addButton(btn => btn
			.setButtonText(t('db_settings_template_choose'))
			.onClick(() => {
				new TemplatePickerModal(this.app, (path) => {
					this.config = { ...this.config, templatePath: path ?? undefined }
					renderPath()
					void this.onSave({ templatePath: this.config.templatePath })
				}, null, this.config.templateFolder ?? null).open()
			}))

		if (this.config.templatePath) {
			tplSetting.addExtraButton(btn => btn
				.setIcon('x')
				.setTooltip(t('db_settings_template_clear'))
				.onClick(async () => {
					this.config = { ...this.config, templatePath: undefined }
					renderPath()
					await this.onSave({ templatePath: undefined })
					this.onOpen()
				}))
		}

		// ── Template folder (issue #42) ───────────────────────────────────
		const tplFolderSetting = new Setting(contentEl)
			.setName(t('db_settings_template_folder_name'))
			.setDesc(t('db_settings_template_folder_desc'))

		const folderEl = contentEl.createDiv({ cls: 'nb-db-settings-template-path' })
		const renderFolder = () => {
			folderEl.empty()
			folderEl.setText(this.config.templateFolder ?? t('db_settings_template_folder_none'))
		}
		renderFolder()

		tplFolderSetting.addButton(btn => btn
			.setButtonText(t('db_settings_template_folder_choose'))
			.onClick(() => {
				new FolderPickerModal(this.app, (folder) => {
					this.config = { ...this.config, templateFolder: folder.path || undefined }
					renderFolder()
					void this.onSave({ templateFolder: this.config.templateFolder })
				}).open()
			}))

		if (this.config.templateFolder) {
			tplFolderSetting.addExtraButton(btn => btn
				.setIcon('x')
				.setTooltip(t('db_settings_template_clear'))
				.onClick(async () => {
					this.config = { ...this.config, templateFolder: undefined }
					renderFolder()
					await this.onSave({ templateFolder: undefined })
					this.onOpen()
				}))
		}

		// ── Ask on create toggle ──────────────────────────────────────────
		new Setting(contentEl)
			.setName(t('db_settings_ask_name'))
			.setDesc(t('db_settings_ask_desc'))
			.addToggle(tg => tg
				.setValue(!!this.config.askTemplateOnCreate)
				.onChange(async (v) => {
					this.config = { ...this.config, askTemplateOnCreate: v }
					await this.onSave({ askTemplateOnCreate: v })
				}))

		// ── Shared properties ─────────────────────────────────────────────
		this.renderSharedPropertiesSection(contentEl)

		// ── Folder arrangement ────────────────────────────────────────────
		this.renderArrangementSection(contentEl)
	}

	private renderSharedPropertiesSection(contentEl: HTMLElement): void {
		if (!this.manager || !this.dbFile) return
		const manager = this.manager
		const registry = manager.sharedProperties.read()
		const section = contentEl.createDiv({ cls: 'nb-db-settings-arrangement' })
		section.createEl('h3', { text: t('shared_properties_title') })
		section.createEl('p', { text: t('shared_properties_desc'), cls: 'nb-db-settings-arrangement-desc' })

		const attached = resolveAttachedSharedProperties(registry, this.config.sharedPropertyIds)
		const list = section.createDiv({ cls: 'nb-arr-property-list' })
		if (attached.definitions.length === 0) {
			list.createEl('p', { text: t('shared_properties_none'), cls: 'nb-arr-empty' })
		}
		for (const definition of attached.definitions) {
			const row = list.createDiv({ cls: 'nb-arr-property-row' })
			row.createSpan({ cls: 'nb-arr-property-name', text: `${definition.name} · ${definition.storageKey}` })
			const editButton = row.createEl('button', { text: t('shared_property_edit'), cls: 'nb-arr-btn' })
			editButton.onclick = () => this.openSharedPropertyEditor(definition)
			const detachButton = row.createEl('button', { text: t('shared_property_detach'), cls: 'nb-arr-btn nb-arr-btn-remove' })
			detachButton.onclick = async () => {
				this.config = detachSharedProperty(this.config, definition.id)
				await this.onSave({ sharedPropertyIds: this.config.sharedPropertyIds })
				this.onOpen()
			}
			const deleteButton = row.createEl('button', { text: t('shared_property_delete_menu'), cls: 'nb-arr-btn nb-arr-btn-remove' })
			deleteButton.onclick = () => {
				new SharedPropertyDeleteModal(this.app, manager, {
					definition,
					onComplete: () => {
						this.config = manager.readConfig(this.dbFile!)
						this.onOpen()
					},
				}).open()
			}
		}

		for (const missingId of attached.missingReferenceIds) {
			const row = list.createDiv({ cls: 'nb-arr-property-row' })
			row.createSpan({ cls: 'nb-arr-property-name', text: `${t('shared_property_missing')} · ${missingId}` })
			const detachButton = row.createEl('button', { text: t('shared_property_detach'), cls: 'nb-arr-btn nb-arr-btn-remove' })
			detachButton.onclick = async () => {
				this.config = detachSharedProperty(this.config, missingId)
				await this.onSave({ sharedPropertyIds: this.config.sharedPropertyIds })
				this.onOpen()
			}
		}

		const available = registry.properties.filter(definition => !(this.config.sharedPropertyIds ?? []).includes(definition.id))
		if (available.length > 0) {
			const addRow = section.createDiv({ cls: 'nb-arr-add-row' })
			const select = addRow.createEl('select', { cls: 'nb-arr-select' })
			select.createEl('option', { text: t('shared_property_attach_placeholder'), value: '' })
			for (const definition of available) {
				select.createEl('option', { text: `${definition.name} · ${definition.storageKey}`, value: definition.id })
			}
			const attachButton = addRow.createEl('button', { text: t('shared_property_attach'), cls: 'mod-cta nb-arr-add-btn' })
			attachButton.onclick = async () => {
				if (!select.value) return
				const error = getSharedPropertyAttachmentError(this.config, registry, select.value)
				if (error) {
					new Notice(error === 'local-collision' ? t('shared_property_collision_local') : t('shared_property_collision'))
					return
				}
				this.config = attachSharedProperty(this.config, registry, select.value)
				await this.onSave({ sharedPropertyIds: this.config.sharedPropertyIds })
				this.onOpen()
			}
		}

		const createButton = section.createEl('button', {
			text: t('shared_property_create'),
			cls: 'nb-arr-preview-btn',
		})
		createButton.onclick = () => this.openSharedPropertyEditor()
	}

	private openSharedPropertyEditor(definition?: SharedPropertyDefinition): void {
		if (!this.manager) return
		new SharedPropertyEditorModal(this.app, {
			definition,
			onSave: async value => {
				try {
					if (definition) {
						await this.manager!.sharedProperties.update({ ...definition, ...value, id: definition.id })
					} else {
						const currentRegistry = this.manager!.sharedProperties.read()
						const candidateId = value.id ?? '__new_shared_property__'
						const candidate = { ...value, id: candidateId }
						const previewRegistry = { ...currentRegistry, properties: [...currentRegistry.properties, candidate] }
						const previewError = getSharedPropertyAttachmentError(this.config, previewRegistry, candidateId)
						if (previewError) {
							new Notice(previewError === 'local-collision'
								? t('shared_property_collision_local') : t('shared_property_collision'))
							throw new Error(previewError)
						}
						const created = await this.manager!.sharedProperties.create(value)
						const registry = this.manager!.sharedProperties.read()
						const error = getSharedPropertyAttachmentError(this.config, registry, created.id)
						if (!error) {
							this.config = attachSharedProperty(this.config, registry, created.id)
							await this.onSave({ sharedPropertyIds: this.config.sharedPropertyIds })
						}
					}
					this.onOpen()
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

	private renderArrangementSection(contentEl: HTMLElement): void {
		const section = contentEl.createDiv({ cls: 'nb-db-settings-arrangement' })
		section.createEl('h3', { text: t('arr_settings_title') })
		section.createEl('p', { text: t('arr_settings_desc'), cls: 'nb-db-settings-arrangement-desc' })

		const current: FolderArrangementConfig = this.config.folderArrangement
			? { enabled: !!this.config.folderArrangement.enabled, propertyIds: [...this.config.folderArrangement.propertyIds] }
			: { enabled: false, propertyIds: [] }

		const persist = async () => {
			this.config = { ...this.config, folderArrangement: current }
			await this.onSave({ folderArrangement: current })
		}

		new Setting(section)
			.setName(t('arr_settings_enabled_name'))
			.setDesc(t('arr_settings_enabled_desc'))
			.addToggle(tg => tg
				.setValue(current.enabled)
				.onChange(async (v) => {
					current.enabled = v
					await persist()
				}))

		const candidates = this.config.schema.filter(c =>
			ARRANGEMENT_SUPPORTED_TYPES.includes(c.type) && !current.propertyIds.includes(c.id)
		)

		const listEl = section.createDiv({ cls: 'nb-arr-property-list' })
		const renderList = () => {
			listEl.empty()
			if (current.propertyIds.length === 0) {
				listEl.createEl('p', { text: t('arr_settings_no_props'), cls: 'nb-arr-empty' })
				return
			}
			current.propertyIds.forEach((id, idx) => {
				const col = this.config.schema.find(c => c.id === id)
				const row = listEl.createDiv({ cls: 'nb-arr-property-row' })
				row.createSpan({ cls: 'nb-arr-property-index', text: String(idx + 1) })
				row.createSpan({ cls: 'nb-arr-property-name', text: col?.name ?? id })

				const upBtn = row.createEl('button', { text: '↑', cls: 'nb-arr-btn' })
				upBtn.disabled = idx === 0
				upBtn.onclick = async () => {
					[current.propertyIds[idx - 1], current.propertyIds[idx]] = [current.propertyIds[idx], current.propertyIds[idx - 1]]
					await persist()
					renderList()
				}

				const downBtn = row.createEl('button', { text: '↓', cls: 'nb-arr-btn' })
				downBtn.disabled = idx === current.propertyIds.length - 1
				downBtn.onclick = async () => {
					[current.propertyIds[idx + 1], current.propertyIds[idx]] = [current.propertyIds[idx], current.propertyIds[idx + 1]]
					await persist()
					renderList()
				}

				const rmBtn = row.createEl('button', { text: '×', cls: 'nb-arr-btn nb-arr-btn-remove' })
				rmBtn.onclick = async () => {
					current.propertyIds.splice(idx, 1)
					await persist()
					renderList()
					renderAddRow()
				}
			})
		}

		const addRow = section.createDiv({ cls: 'nb-arr-add-row' })
		const renderAddRow = () => {
			addRow.empty()
			const remaining = this.config.schema.filter(c =>
				ARRANGEMENT_SUPPORTED_TYPES.includes(c.type) && !current.propertyIds.includes(c.id)
			)
			if (remaining.length === 0 && candidates.length === 0) {
				addRow.createEl('p', { text: t('arr_settings_no_candidates'), cls: 'nb-arr-empty' })
				return
			}
			if (remaining.length === 0) return

			const select = addRow.createEl('select', { cls: 'nb-arr-select' })
			select.createEl('option', { text: t('arr_settings_add_placeholder'), value: '' })
			for (const c of remaining) {
				select.createEl('option', { text: c.name, value: c.id })
			}
			const addBtn = addRow.createEl('button', { text: t('arr_settings_add_btn'), cls: 'mod-cta nb-arr-add-btn' })
			addBtn.onclick = async () => {
				const v = select.value
				if (!v) return
				current.propertyIds.push(v)
				await persist()
				renderList()
				renderAddRow()
			}
		}

		renderList()
		renderAddRow()

		// Preview & apply button
		if (this.manager && this.dbFile) {
			const previewBtn = section.createEl('button', {
				text: t('arr_settings_preview_btn'),
				cls: 'nb-arr-preview-btn',
			})
			previewBtn.onclick = () => {
				if (!this.manager || !this.dbFile) return
				new FolderArrangementPreviewModal(this.app, this.manager, this.dbFile, { ...this.config, folderArrangement: current }, this.restrictToPaths).open()
			}
		}
	}

	onClose(): void {
		this.contentEl.empty()
	}
}
