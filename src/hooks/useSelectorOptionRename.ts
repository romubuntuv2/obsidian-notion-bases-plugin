import { useCallback } from 'react'
import { Notice, TFile } from 'obsidian'
import { App } from 'obsidian'
import { DatabaseManager } from '../database-manager'
import { ColumnSchema, DatabaseConfig, SelectOption } from '../types'
import { t } from '../i18n'
import { SELECTOR_OPTION_COLORS } from '../shared-properties'
import { SharedOptionDeleteModal } from '../shared-property-deletion-modals'

export type RenameSelectorOptionHandler = (
	column: ColumnSchema,
	oldValue: string,
	newValue: string,
	currentOptions: SelectOption[],
) => Promise<void>

export type CreateSelectorOptionHandler = (
	column: ColumnSchema,
	name: string,
	currentOptions: SelectOption[],
) => Promise<SelectOption>

export type ColorSelectorOptionHandler = (
	column: ColumnSchema,
	optionValue: string,
	color: string,
	currentOptions: SelectOption[],
) => Promise<void>

export type DeleteSelectorOptionHandler = (
	column: ColumnSchema,
	optionValue: string,
	currentOptions: SelectOption[],
) => Promise<void>

interface UseSelectorOptionRenameOptions {
	manager: DatabaseManager
	dbFile: TFile | null
	config: DatabaseConfig
	onLocalConfigChange?: (config: DatabaseConfig) => void
	onComplete?: () => void
}

interface UseSelectorOptionDeleteOptions extends UseSelectorOptionRenameOptions {
	app: App
}

function showSelectorOptionError(error: unknown, fallbackKey: 'selector_option_rename_error' | 'selector_option_create_error'): void {
	const message = error instanceof Error ? error.message : ''
	new Notice(message === 'duplicate-selector-option'
		? t('selector_option_duplicate')
		: message === 'invalid-selector-option-name'
			? t('selector_option_invalid')
			: t(fallbackKey))
}

export function useSelectorOptionRename({
	manager, dbFile, config, onLocalConfigChange, onComplete,
}: UseSelectorOptionRenameOptions): RenameSelectorOptionHandler {
	return useCallback(async (column, oldValue, newValue, currentOptions) => {
		try {
			if (column.propertyScope === 'shared') {
				if (!column.sharedPropertyId) throw new Error('missing-shared-property')
				await manager.renameSharedOption(column.sharedPropertyId, oldValue, newValue, currentOptions)
			} else {
				if (!dbFile) throw new Error('missing-database')
				const nextConfig = await manager.renameDatabaseOption(
					dbFile, config, column.id, oldValue, newValue, currentOptions,
				)
				onLocalConfigChange?.(nextConfig)
			}
			onComplete?.()
		} catch (error) {
			showSelectorOptionError(error, 'selector_option_rename_error')
			throw error
		}
	}, [config, dbFile, manager, onComplete, onLocalConfigChange])
}

export function useSelectorOptionCreate({
	manager, dbFile, config, onLocalConfigChange, onComplete,
}: UseSelectorOptionRenameOptions): CreateSelectorOptionHandler {
	return useCallback(async (column, name, currentOptions) => {
		const option: SelectOption = {
			value: name,
			color: SELECTOR_OPTION_COLORS[currentOptions.length % SELECTOR_OPTION_COLORS.length],
		}
		try {
			if (column.propertyScope === 'shared') {
				if (!column.sharedPropertyId) throw new Error('missing-shared-property')
				await manager.addSharedOption(column.sharedPropertyId, option, currentOptions)
			} else {
				if (!dbFile) throw new Error('missing-database')
				const nextConfig = await manager.addDatabaseOption(dbFile, config, column.id, option, currentOptions)
				onLocalConfigChange?.(nextConfig)
			}
			onComplete?.()
			return option
		} catch (error) {
			showSelectorOptionError(error, 'selector_option_create_error')
			throw error
		}
	}, [config, dbFile, manager, onComplete, onLocalConfigChange])
}

export function useSelectorOptionColor({
	manager, dbFile, config, onLocalConfigChange, onComplete,
}: UseSelectorOptionRenameOptions): ColorSelectorOptionHandler {
	return useCallback(async (column, optionValue, color, currentOptions) => {
		try {
			if (column.propertyScope === 'shared') {
				if (!column.sharedPropertyId) throw new Error('missing-shared-property')
				await manager.recolorSharedOption(column.sharedPropertyId, optionValue, color, currentOptions)
			} else {
				if (!dbFile) throw new Error('missing-database')
				const nextConfig = await manager.recolorDatabaseOption(
					dbFile, config, column.id, optionValue, color, currentOptions,
				)
				onLocalConfigChange?.(nextConfig)
			}
			onComplete?.()
		} catch (error) {
			new Notice(t('selector_option_color_error'))
			throw error
		}
	}, [config, dbFile, manager, onComplete, onLocalConfigChange])
}

export function useSelectorOptionDelete({
	app, manager, dbFile, config, onLocalConfigChange, onComplete,
}: UseSelectorOptionDeleteOptions): DeleteSelectorOptionHandler {
	return useCallback(async (column, optionValue, currentOptions) => {
		try {
			if (column.propertyScope === 'shared') {
				new SharedOptionDeleteModal(app, manager, {
					column,
					optionValue,
					onComplete,
				}).open()
				return
			}
			if (!dbFile) throw new Error('missing-database')
			const nextConfig = await manager.removeDatabaseOption(
				dbFile, config, column.id, optionValue, currentOptions,
			)
			onLocalConfigChange?.(nextConfig)
			onComplete?.()
		} catch (error) {
			new Notice(t('selector_option_delete_error'))
			throw error
		}
	}, [app, config, dbFile, manager, onComplete, onLocalConfigChange])
}
