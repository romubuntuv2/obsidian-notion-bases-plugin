import { App, PluginSettingTab, Setting } from 'obsidian'
import NotionBasesPlugin from './main'
import { ViewConfig } from './types'
import { runtimePrefs } from './runtime-prefs'
import { t } from './i18n'
import { SharedPropertiesManagerModal } from './shared-properties-manager-modal'

export interface VirtualPropertyMenuVisibility {
	parentFolder: boolean
	path: boolean
	ctime: boolean
	mtime: boolean
}

export interface NotionBasesSettings {
	databaseFileName: string
	defaultRowHeight: number
	embedViews: Record<string, ViewConfig>
	readInlineFields: boolean
	pageSize: number
	clipEllipsis: boolean,
	showDatabasePathInPicker: boolean
	virtualPropertyMenuVisibility: VirtualPropertyMenuVisibility
}

export const DEFAULT_SETTINGS: NotionBasesSettings = {
	databaseFileName: '_database.md',
	defaultRowHeight: 36,
	embedViews: {},
	readInlineFields: false,
	pageSize: 0,
	clipEllipsis: true,
	showDatabasePathInPicker: true,
	virtualPropertyMenuVisibility: {
		parentFolder: true,
		path: true,
		ctime: false,
		mtime: false,
	},
}

export class NotionBasesSettingTab extends PluginSettingTab {
	plugin: NotionBasesPlugin

	constructor(app: App, plugin: NotionBasesPlugin) {
		super(app, plugin)
		this.plugin = plugin
	}

	display(): void {
		const { containerEl } = this
		containerEl.empty()

		new Setting(containerEl)
			.setName(t('settings_db_filename_name'))
			.setDesc(t('settings_db_filename_desc'))
			.addText(text =>
				text
					.setPlaceholder('_database.md')
					.setValue(this.plugin.settings.databaseFileName)
					.onChange(async value => {
						this.plugin.settings.databaseFileName = value || '_database.md'
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('shared_manager_title'))
			.setDesc(t('shared_manager_settings_desc'))
			.setHeading()

		new Setting(containerEl)
			.setName(t('shared_manager_settings_name'))
			.setDesc(t('shared_manager_settings_desc'))
			.addButton(button => button
				.setButtonText(t('shared_manager_open'))
				.setCta()
				.onClick(() => new SharedPropertiesManagerModal(this.app, this.plugin.manager).open()))

		new Setting(containerEl)
			.setName(t('settings_virtual_fields_heading'))
			.setDesc(t('settings_virtual_fields_desc'))
			.setHeading()

		const virtualFields: Array<{ key: keyof VirtualPropertyMenuVisibility; label: string }> = [
			{ key: 'parentFolder', label: `📁 ${t('folder_column')}` },
			{ key: 'path', label: `🧭 ${t('file_path')}` },
			{ key: 'ctime', label: `🕓 ${t('created_time')}` },
			{ key: 'mtime', label: `🖊 ${t('last_edited_time')}` },
		]
		for (const field of virtualFields) {
			new Setting(containerEl)
				.setName(field.label)
				.setDesc(t('settings_virtual_field_toggle_desc'))
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.virtualPropertyMenuVisibility[field.key])
					.onChange(async value => {
						this.plugin.settings.virtualPropertyMenuVisibility[field.key] = value
						runtimePrefs.virtualPropertyMenuVisibility[field.key] = value
						await this.plugin.saveSettings()
					}))
		}

		new Setting(containerEl)
			.setName(t('settings_inline_fields_name'))
			.setDesc(t('settings_inline_fields_desc'))
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.readInlineFields)
					.onChange(async value => {
						this.plugin.settings.readInlineFields = value
						this.plugin.manager.readInlineFields = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_clip_ellipsis_name'))
			.setDesc(t('settings_clip_ellipsis_desc'))
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.clipEllipsis)
					.onChange(async value => {
						this.plugin.settings.clipEllipsis = value
						runtimePrefs.clipEllipsis = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_row_height_name'))
			.setDesc(t('settings_row_height_desc'))
			.addSlider(slider =>
				slider
					.setLimits(28, 80, 4)
					.setValue(this.plugin.settings.defaultRowHeight)
					.onChange(async value => {
						this.plugin.settings.defaultRowHeight = value
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName(t('settings_page_size_name'))
			.setDesc(t('settings_page_size_desc'))
			.addDropdown(dropdown =>
				dropdown
					.addOptions({
						'0': t('settings_page_size_all'),
						'50': '50',
						'100': '100',
						'200': '200',
					})
					.setValue(String(this.plugin.settings.pageSize))
					.onChange(async value => {
						this.plugin.settings.pageSize = Number(value)
						this.plugin.manager.pageSize = Number(value)
						await this.plugin.saveSettings()
					})
			)

		new Setting(containerEl)
			.setName('setting_show_database_path') // ADD TRANSLATION
			.setDesc('setting_show_database_path_desc') // ADD TRANSLATION
			.addToggle(toggle =>
				toggle
					.setValue(this.plugin.settings.showDatabasePathInPicker)
					.onChange(async value => {

						this.plugin.settings.showDatabasePathInPicker = value

						await this.plugin.saveSettings()
					})
			)
	}
}
