import type { TFile } from 'obsidian'
import type { DatabaseManager } from './database-manager'
import { ColumnSchema, DatabaseConfig, ViewConfig, VirtualPropertySource } from './types'
import { formatTimestampLocal } from './value-utils'
import { t } from './i18n'
import { runtimePrefs } from './runtime-prefs'

export const VIRTUAL_PROPERTY_IDS: Record<VirtualPropertySource, string> = {
	title: '_title',
	parentFolder: '_parentFolder',
	path: '_path',
	ctime: '_ctime',
	mtime: '_mtime',
}

export const VIRTUAL_PROPERTIES_SCHEMA_VERSION = 1

export interface VirtualPropertyMigrationResult {
	config: DatabaseConfig
	migrated: boolean
}

function replaceFormulaReference(formula: string, fromId: string, toId: string): string {
	const escaped = fromId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
	let result = formula.replace(new RegExp(`\\[${escaped}\\]`, 'g'), `[${toId}]`)
	if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(fromId)) {
		result = result.replace(new RegExp(`\\b${escaped}\\b`, 'g'), toId)
	}
	return result
}

function remapRecordKeys<T>(record: Record<string, T> | undefined, idMap: Map<string, string>): Record<string, T> | undefined {
	if (!record) return undefined
	const result: Record<string, T> = {}
	for (const [id, value] of Object.entries(record)) result[idMap.get(id) ?? id] = value
	return result
}

/** One-time migration from local timestamp columns and the old synthetic `_folder` UI. */
export function migrateLegacyVirtualProperties(config: DatabaseConfig): VirtualPropertyMigrationResult {
	if ((config.virtualPropertiesVersion ?? 0) >= VIRTUAL_PROPERTIES_SCHEMA_VERSION) {
		return { config, migrated: false }
	}

	const legacySystemColumns = config.schema.filter(column => column.systemField)
	const idMap = new Map<string, string>(legacySystemColumns.map(column => [
		column.id,
		column.systemField === 'ctime' ? VIRTUAL_PROPERTY_IDS.ctime : VIRTUAL_PROPERTY_IDS.mtime,
	]))
	idMap.set('_folder', VIRTUAL_PROPERTY_IDS.parentFolder)
	const migratedSchema = config.schema
		.filter(column => !column.systemField)
		.map(column => {
			let formula = column.formula
			for (const [fromId, toId] of idMap) {
				if (formula) formula = replaceFormulaReference(formula, fromId, toId)
			}
			const remap = (id: string | undefined) => id ? (idMap.get(id) ?? id) : undefined
			return {
				...column,
				formula,
				refColumnId: remap(column.refColumnId),
				refMatchColumnId: remap(column.refMatchColumnId),
				pairedColumnId: remap(column.pairedColumnId),
				rollupRelationColumnId: remap(column.rollupRelationColumnId),
				rollupTargetColumnId: remap(column.rollupTargetColumnId),
			}
		})

	const migratedViews = config.views.map(view => {
		const remap = (id: string) => idMap.get(id) ?? id
		const legacyVisibleVirtualIds = legacySystemColumns
			.filter(column => column.visible && !view.hiddenColumns.includes(column.id))
			.map(column => remap(column.id))
		const preserveOldFolder = !!view.includeSubfolders && !view.hiddenColumns.includes('_folder')
		const virtualColumnIds = Array.from(new Set([
			...(view.virtualColumnIds ?? []).map(remap),
			...legacyVisibleVirtualIds,
			...(preserveOldFolder ? [VIRTUAL_PROPERTY_IDS.parentFolder] : []),
		]))
		const layoutIds = new Set(idMap.keys())
		return {
			...view,
			virtualColumnIds,
			filters: view.filters.map(filter => ({ ...filter, columnId: remap(filter.columnId) })),
			sorts: view.sorts.map(sort => ({ ...sort, columnId: remap(sort.columnId) })),
			activePills: view.activePills?.map(pill => ({ ...pill, columnId: remap(pill.columnId) })),
			hiddenColumns: view.hiddenColumns.filter(id => !idMap.has(id) && id !== '_folder'),
			columnOrder: view.columnOrder ? Array.from(new Set(view.columnOrder.map(remap))) : undefined,
			columnWidths: remapRecordKeys(view.columnWidths, idMap) ?? {},
			aggregations: remapRecordKeys(view.aggregations, idMap),
			conditionalFormats: view.conditionalFormats?.map(rule => ({ ...rule, columnId: remap(rule.columnId) })),
			pinnedColumnId: view.pinnedColumnId ? remap(view.pinnedColumnId) : view.pinnedColumnId,
			calendarDateField: view.calendarDateField && layoutIds.has(view.calendarDateField) ? undefined : view.calendarDateField,
			timelineStartField: view.timelineStartField && layoutIds.has(view.timelineStartField) ? undefined : view.timelineStartField,
			timelineEndField: view.timelineEndField && layoutIds.has(view.timelineEndField) ? undefined : view.timelineEndField,
			chartXAxis: view.chartXAxis ? remap(view.chartXAxis) : view.chartXAxis,
			chartYAxis: view.chartYAxis ? remap(view.chartYAxis) : view.chartYAxis,
		}
	})

	return {
		config: {
			...config,
			schema: migratedSchema,
			views: migratedViews,
			virtualPropertiesVersion: VIRTUAL_PROPERTIES_SCHEMA_VERSION,
		},
		migrated: true,
	}
}

function createVirtualPropertyDefinitions(): ColumnSchema[] {
	return [
		{ id: VIRTUAL_PROPERTY_IDS.title, name: t('name_column'), type: 'title', visible: true,
			propertyScope: 'virtual', virtualSource: 'title' },
		{ id: VIRTUAL_PROPERTY_IDS.parentFolder, name: t('folder_column'), type: 'text', visible: false,
			propertyScope: 'virtual', virtualSource: 'parentFolder' },
		{ id: VIRTUAL_PROPERTY_IDS.path, name: t('file_path'), type: 'text', visible: false,
			propertyScope: 'virtual', virtualSource: 'path' },
		{ id: VIRTUAL_PROPERTY_IDS.ctime, name: t('created_time'), type: 'date', visible: false,
			propertyScope: 'virtual', virtualSource: 'ctime', systemField: 'ctime' },
		{ id: VIRTUAL_PROPERTY_IDS.mtime, name: t('last_edited_time'), type: 'date', visible: false,
			propertyScope: 'virtual', virtualSource: 'mtime', systemField: 'mtime' },
	]
}

export interface PropertyCapabilities {
	readable: true
	editable: boolean
	persistedInFrontmatter: boolean
}

export interface EffectiveSchema {
	schema: ColumnSchema[]
	localSchema: ColumnSchema[]
	sharedSchema: ColumnSchema[]
	virtualSchema: ColumnSchema[]
	reservedIdCollisions: string[]
	sharedStorageKeyCollisions: string[]
}

export function getVirtualPropertyDefinitions(): ColumnSchema[] {
	return createVirtualPropertyDefinitions()
}

export function getVirtualPropertyById(id: string): ColumnSchema | undefined {
	const column = createVirtualPropertyDefinitions().find(candidate => candidate.id === id)
	return column ? { ...column } : undefined
}

export function getSelectableVirtualProperties(effectiveSchema: ColumnSchema[]): ColumnSchema[] {
	return effectiveSchema.filter(column => column.propertyScope === 'virtual' && column.virtualSource !== 'title')
}

export function getSelectedVirtualProperties(effectiveSchema: ColumnSchema[], virtualColumnIds: string[] | undefined): ColumnSchema[] {
	const selected = new Set(virtualColumnIds ?? [])
	return getSelectableVirtualProperties(effectiveSchema).filter(column => selected.has(column.id))
}

export function toggleVirtualProperty(virtualColumnIds: string[] | undefined, columnId: string): string[] {
	const current = virtualColumnIds ?? []
	return current.includes(columnId)
		? current.filter(id => id !== columnId)
		: [...current, columnId]
}

/** Properties offered by view field/filter/sort menus (title has its own UI). */
export function getViewPropertyColumns(effectiveSchema: ColumnSchema[]): ColumnSchema[] {
	return effectiveSchema.filter(column => column.virtualSource !== 'title')
}

/** Columns shown specifically in the Fields menu, respecting global plugin preferences. */
export function getFieldMenuColumns(effectiveSchema: ColumnSchema[]): ColumnSchema[] {
	return getViewPropertyColumns(effectiveSchema).filter(column => {
		if (!column.virtualSource || column.virtualSource === 'title') return true
		return runtimePrefs.virtualPropertyMenuVisibility[column.virtualSource]
	})
}

export function getPropertyIcon(column: ColumnSchema): string | undefined {
	switch (column.virtualSource) {
		case 'title': return '📄'
		case 'parentFolder': return '📁'
		case 'path': return '🧭'
		case 'ctime': return '🕓'
		case 'mtime': return '🖊'
		default: return undefined
	}
}

/** Properties rendered by a card/list/table view, preserving effective-schema order. */
export function getVisibleViewProperties(effectiveSchema: ColumnSchema[], view: ViewConfig): ColumnSchema[] {
	const selectedVirtualIds = new Set(view.virtualColumnIds ?? [])
	return getViewPropertyColumns(effectiveSchema).filter(column => column.propertyScope === 'virtual'
		? selectedVirtualIds.has(column.id)
		: column.visible && !view.hiddenColumns.includes(column.id))
}

export function isPropertyVisibleInView(column: ColumnSchema, view: ViewConfig): boolean {
	return column.propertyScope === 'virtual'
		? (view.virtualColumnIds ?? []).includes(column.id)
		: column.visible && !view.hiddenColumns.includes(column.id)
}

/** Toggle a view-owned field without ever persisting a virtual definition in local schema. */
export function toggleViewProperty(view: ViewConfig, column: ColumnSchema): ViewConfig {
	if (column.propertyScope === 'virtual') {
		return { ...view, virtualColumnIds: toggleVirtualProperty(view.virtualColumnIds, column.id) }
	}
	const hiddenColumns = view.hiddenColumns.includes(column.id)
		? view.hiddenColumns.filter(id => id !== column.id)
		: [...view.hiddenColumns, column.id]
	return { ...view, hiddenColumns }
}

export function getPropertyCapabilities(column: ColumnSchema): PropertyCapabilities {
	if (column.virtualSource) {
		return {
			readable: true,
			editable: column.virtualSource === 'title',
			persistedInFrontmatter: false,
		}
	}
	if (column.systemField) {
		return { readable: true, editable: false, persistedInFrontmatter: false }
	}
	return { readable: true, editable: true, persistedInFrontmatter: true }
}

export function resolveEffectiveSchema(localSchema: ColumnSchema[], attachedSharedSchema: ColumnSchema[] = []): EffectiveSchema {
	const local = localSchema.map(column => ({
		...column,
		propertyScope: column.propertyScope ?? 'database',
	}))
	const localIds = new Set(local.map(column => column.id))
	const shared = attachedSharedSchema.map(column => ({
		...column,
		propertyScope: 'shared' as const,
	}))
	const virtualSchema = createVirtualPropertyDefinitions()
	const virtualIds = new Set(virtualSchema.map(column => column.id))
	const sharedStorageKeyCollisions = shared
		.filter((column, index) => localIds.has(column.id) || shared.findIndex(candidate => candidate.id === column.id) !== index)
		.map(column => column.id)
	const reservedIdCollisions = virtualSchema
		.filter(column => localIds.has(column.id) || shared.some(sharedColumn => sharedColumn.id === column.id))
		.map(column => column.id)
	const availableLocalColumns = local.filter(column => !virtualIds.has(column.id))
	const availableSharedColumns = shared.filter((column, index) =>
		!virtualIds.has(column.id) &&
		!localIds.has(column.id) &&
		shared.findIndex(candidate => candidate.id === column.id) === index
	)
	return {
		schema: [...availableLocalColumns, ...availableSharedColumns, ...virtualSchema],
		localSchema: local,
		sharedSchema: shared,
		virtualSchema,
		reservedIdCollisions,
		sharedStorageKeyCollisions,
	}
}

export function readVirtualProperty(file: TFile, source: VirtualPropertySource): unknown {
	switch (source) {
		case 'title': return file.basename
		case 'parentFolder': return file.parent?.path ?? ''
		case 'path': return file.path
		case 'ctime': return formatTimestampLocal(file.stat.ctime)
		case 'mtime': return formatTimestampLocal(file.stat.mtime)
	}
}

export async function updateVirtualProperty(
	manager: Pick<DatabaseManager, 'renameNote'>,
	file: TFile,
	source: VirtualPropertySource,
	value: unknown,
): Promise<boolean> {
	if (source !== 'title') return false
	await manager.renameNote(file, String(value))
	return true
}
