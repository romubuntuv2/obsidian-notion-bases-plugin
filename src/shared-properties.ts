import { App, TFile } from 'obsidian'
import {
	ColumnSchema, ColumnType, DatabaseConfig, SelectOption, SharedPropertyDefinition, SharedPropertyRegistry,
} from './types'
import { VIRTUAL_PROPERTY_IDS } from './virtual-properties'

export const SHARED_PROPERTIES_REGISTRY_PATH = 'register_shared_propertiers.md'
export const SHARED_PROPERTIES_REGISTRY_MARKER = 'notion-bases-shared-properties'
export const SHARED_PROPERTIES_REGISTRY_VERSION = 1
export const SELECTOR_OPTION_COLORS = [
	'#e2d9f3', '#d1e8ff', '#d4f1c0', '#fde8c8',
	'#ffd6d6', '#d6f0f0', '#f0d6f0', '#f0f0d6',
]

export const SHARED_PROPERTY_TYPES: ColumnType[] = [
	'text', 'number', 'select', 'multiselect', 'status', 'date', 'checkbox', 'url', 'email', 'phone',
]

export const EMPTY_SHARED_PROPERTY_REGISTRY: SharedPropertyRegistry = {
	version: SHARED_PROPERTIES_REGISTRY_VERSION,
	properties: [],
}

export interface AttachedSharedProperties {
	columns: ColumnSchema[]
	definitions: SharedPropertyDefinition[]
	missingReferenceIds: string[]
}

export interface MissingSharedPropertyReference {
	databasePath: string
	sharedPropertyId: string
}

export function findMissingSharedPropertyReferences(
	registry: SharedPropertyRegistry,
	databases: Array<{ path: string; sharedPropertyIds?: string[] }>,
): MissingSharedPropertyReference[] {
	const knownIds = new Set(registry.properties.map(property => property.id))
	return databases.flatMap(database =>
		Array.from(new Set(database.sharedPropertyIds ?? []))
			.filter(sharedPropertyId => !knownIds.has(sharedPropertyId))
			.map(sharedPropertyId => ({ databasePath: database.path, sharedPropertyId })))
}

function cloneOptions(options: SelectOption[] | undefined): SelectOption[] | undefined {
	return options?.map(option => ({ ...option }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

function sanitizeOptions(value: unknown): SelectOption[] | undefined {
	if (!Array.isArray(value)) return undefined
	const seen = new Set<string>()
	const options: SelectOption[] = []
	for (const raw of value) {
		if (!isRecord(raw) || typeof raw.value !== 'string') continue
		const optionValue = raw.value.trim()
		if (!optionValue || seen.has(optionValue)) continue
		seen.add(optionValue)
		options.push({
			value: optionValue,
			...(typeof raw.color === 'string' && raw.color ? { color: raw.color } : {}),
		})
	}
	return options
}

export function sanitizeSharedPropertyDefinition(value: unknown): SharedPropertyDefinition | null {
	if (!isRecord(value)) return null
	if (typeof value.id !== 'string' || !value.id.trim()) return null
	if (typeof value.storageKey !== 'string' || !value.storageKey.trim()) return null
	const storageKey = value.storageKey.trim()
	if (storageKey.includes('\n') || storageKey.startsWith('notion-bases') ||
		storageKey === '_file' || storageKey === '_inlineFields' || Object.values(VIRTUAL_PROPERTY_IDS).includes(storageKey)) return null
	if (typeof value.name !== 'string' || !value.name.trim()) return null
	if (typeof value.type !== 'string' || !SHARED_PROPERTY_TYPES.includes(value.type as ColumnType)) return null
	const numberFormat = isRecord(value.numberFormat) &&
		typeof value.numberFormat.decimals === 'number' &&
		typeof value.numberFormat.thousandsSeparator === 'boolean'
		? {
			decimals: value.numberFormat.decimals,
			thousandsSeparator: value.numberFormat.thousandsSeparator,
			...(typeof value.numberFormat.prefix === 'string' ? { prefix: value.numberFormat.prefix } : {}),
			...(typeof value.numberFormat.suffix === 'string' ? { suffix: value.numberFormat.suffix } : {}),
		} : undefined
	return {
		id: value.id.trim(),
		storageKey,
		name: value.name.trim(),
		type: value.type as ColumnType,
		options: sanitizeOptions(value.options),
		...(numberFormat ? { numberFormat } : {}),
		...(typeof value.dateFormat === 'string' ? { dateFormat: value.dateFormat } : {}),
	}
}

export function sanitizeSharedPropertyRegistry(value: unknown): SharedPropertyRegistry {
	if (!isRecord(value)) return structuredClone(EMPTY_SHARED_PROPERTY_REGISTRY)
	const rawProperties = Array.isArray(value.properties) ? value.properties : []
	const seenIds = new Set<string>()
	const seenKeys = new Set<string>()
	const properties: SharedPropertyDefinition[] = []
	for (const raw of rawProperties) {
		const definition = sanitizeSharedPropertyDefinition(raw)
		if (!definition || seenIds.has(definition.id) || seenKeys.has(definition.storageKey)) continue
		seenIds.add(definition.id)
		seenKeys.add(definition.storageKey)
		properties.push(definition)
	}
	return {
		version: typeof value.version === 'number' ? value.version : SHARED_PROPERTIES_REGISTRY_VERSION,
		properties,
	}
}

export function sharedDefinitionToColumn(definition: SharedPropertyDefinition): ColumnSchema {
	return {
		id: definition.storageKey,
		name: definition.name,
		type: definition.type,
		visible: true,
		propertyScope: 'shared',
		sharedPropertyId: definition.id,
		options: cloneOptions(definition.options),
		numberFormat: definition.numberFormat ? { ...definition.numberFormat } : undefined,
		dateFormat: definition.dateFormat,
	}
}

export function sharedDefinitionToLocalColumn(definition: SharedPropertyDefinition): ColumnSchema {
	return {
		id: definition.storageKey,
		name: definition.name,
		type: definition.type,
		visible: true,
		options: cloneOptions(definition.options),
		numberFormat: definition.numberFormat ? { ...definition.numberFormat } : undefined,
		dateFormat: definition.dateFormat,
	}
}

export function resolveAttachedSharedProperties(
	registry: SharedPropertyRegistry,
	sharedPropertyIds: string[] | undefined,
): AttachedSharedProperties {
	const byId = new Map(registry.properties.map(definition => [definition.id, definition]))
	const definitions: SharedPropertyDefinition[] = []
	const missingReferenceIds: string[] = []
	for (const id of Array.from(new Set(sharedPropertyIds ?? []))) {
		const definition = byId.get(id)
		if (definition) definitions.push(definition)
		else missingReferenceIds.push(id)
	}
	return {
		definitions,
		columns: definitions.map(sharedDefinitionToColumn),
		missingReferenceIds,
	}
}

export type SharedPropertyAttachmentError = 'missing' | 'local-collision' | 'virtual-collision' | 'shared-key-collision'

export function getSharedPropertyAttachmentError(
	config: DatabaseConfig,
	registry: SharedPropertyRegistry,
	sharedPropertyId: string,
): SharedPropertyAttachmentError | null {
	const definition = registry.properties.find(property => property.id === sharedPropertyId)
	if (!definition) return 'missing'
	if (config.schema.some(column => column.id === definition.storageKey)) return 'local-collision'
	if (Object.values(VIRTUAL_PROPERTY_IDS).includes(definition.storageKey)) return 'virtual-collision'
	const attached = resolveAttachedSharedProperties(registry, config.sharedPropertyIds).definitions
	if (attached.some(property => property.id !== definition.id && property.storageKey === definition.storageKey)) {
		return 'shared-key-collision'
	}
	return null
}

export function attachSharedProperty(config: DatabaseConfig, registry: SharedPropertyRegistry, sharedPropertyId: string): DatabaseConfig {
	if ((config.sharedPropertyIds ?? []).includes(sharedPropertyId)) return config
	const error = getSharedPropertyAttachmentError(config, registry, sharedPropertyId)
	if (error) throw new Error(error)
	return { ...config, sharedPropertyIds: [...(config.sharedPropertyIds ?? []), sharedPropertyId] }
}

export function detachSharedProperty(config: DatabaseConfig, sharedPropertyId: string): DatabaseConfig {
	return { ...config, sharedPropertyIds: (config.sharedPropertyIds ?? []).filter(id => id !== sharedPropertyId) }
}

export type SharedOptionRemovalMode = 'replace' | 'clear' | 'preserve'

export function appendSelectorOption(
	options: SelectOption[] | undefined,
	option: SelectOption,
): SelectOption[] {
	const value = option.value.trim()
	if (!value) throw new Error('invalid-selector-option-name')
	if (options?.some(candidate => candidate.value === value)) throw new Error('duplicate-selector-option')
	return [...(options?.map(candidate => ({ ...candidate })) ?? []), { ...option, value }]
}

export function recolorSelectorOption(
	options: SelectOption[] | undefined,
	optionValue: string,
	color: string,
): SelectOption[] {
	if (!options?.some(option => option.value === optionValue)) throw new Error('missing-selector-option')
	return options.map(option => option.value === optionValue ? { ...option, color } : { ...option })
}

export function renameSelectorOption(
	options: SelectOption[] | undefined,
	oldValue: string,
	newValue: string,
): SelectOption[] {
	const trimmed = newValue.trim()
	if (!trimmed) throw new Error('invalid-selector-option-name')
	if (!options?.some(option => option.value === oldValue)) throw new Error('missing-selector-option')
	if (trimmed !== oldValue && options.some(option => option.value === trimmed)) {
		throw new Error('duplicate-selector-option')
	}
	return options.map(option => option.value === oldValue ? { ...option, value: trimmed } : { ...option })
}

function sharedScalarMatchesOption(value: unknown, optionValue: string): boolean {
	if (typeof value === 'string') return value === optionValue
	if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') {
		return String(value) === optionValue
	}
	return false
}

export function sharedValueContainsOption(value: unknown, optionValue: string): boolean {
	return Array.isArray(value)
		? (value as unknown[]).some(item => sharedScalarMatchesOption(item, optionValue))
		: sharedScalarMatchesOption(value, optionValue)
}

export function resolveSharedOptionRemovalValue(
	value: unknown,
	optionValue: string,
	mode: SharedOptionRemovalMode,
	replacement?: string,
): unknown {
	if (mode === 'preserve' || !sharedValueContainsOption(value, optionValue)) return value
	if (Array.isArray(value)) {
		const next: unknown[] = []
		for (const item of value as unknown[]) {
			if (!sharedScalarMatchesOption(item, optionValue)) next.push(item)
			else if (mode === 'replace' && replacement) next.push(replacement)
		}
		const deduplicated = Array.from(new Set<unknown>(next))
		return deduplicated.length > 0 ? deduplicated : null
	}
	return mode === 'replace' && replacement ? replacement : null
}

export function resolveRenamedOptionValue(value: unknown, oldValue: string, newValue: string): unknown {
	return resolveSharedOptionRemovalValue(value, oldValue, 'replace', newValue)
}

export class SharedPropertyRegistryStore {
	private lastKnownRegistry: SharedPropertyRegistry = structuredClone(EMPTY_SHARED_PROPERTY_REGISTRY)
	private preferLastKnownUntil = 0

	constructor(private app: App) {}

	read(): SharedPropertyRegistry {
		if (Date.now() < this.preferLastKnownUntil) return structuredClone(this.lastKnownRegistry)
		const file = this.app.vault.getFileByPath(SHARED_PROPERTIES_REGISTRY_PATH)
		if (!file || !(file instanceof TFile)) return structuredClone(EMPTY_SHARED_PROPERTY_REGISTRY)
		const frontmatter: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter
		if (!isRecord(frontmatter)) return structuredClone(this.lastKnownRegistry)
		if (frontmatter[SHARED_PROPERTIES_REGISTRY_MARKER] !== true) return structuredClone(EMPTY_SHARED_PROPERTY_REGISTRY)
		const registry = sanitizeSharedPropertyRegistry({
			version: frontmatter['version'],
			properties: frontmatter['properties'],
		})
		this.lastKnownRegistry = registry
		return structuredClone(registry)
	}

	async write(registry: SharedPropertyRegistry): Promise<void> {
		const clean = sanitizeSharedPropertyRegistry(registry)
		let file = this.app.vault.getFileByPath(SHARED_PROPERTIES_REGISTRY_PATH)
		let created = false
		if (!file) {
			file = await this.app.vault.create(SHARED_PROPERTIES_REGISTRY_PATH, [
				'---',
				`${SHARED_PROPERTIES_REGISTRY_MARKER}: true`,
				`version: ${SHARED_PROPERTIES_REGISTRY_VERSION}`,
				'properties: []',
				'---',
				'',
				'# Shared properties',
				'',
				'This file is managed by Notion Bases.',
			].join('\n'))
			created = true
		}
		if (!(file instanceof TFile)) throw new Error('shared-property-registry-path-is-not-a-file')
		if (!created) {
			const cachedFrontmatter: unknown = this.app.metadataCache.getFileCache(file)?.frontmatter
			if (isRecord(cachedFrontmatter)) {
				if (cachedFrontmatter[SHARED_PROPERTIES_REGISTRY_MARKER] !== true) throw new Error('shared-property-registry-conflict')
			} else {
				const content = await this.app.vault.read(file)
				if (!new RegExp(`^${SHARED_PROPERTIES_REGISTRY_MARKER}:\\s*true\\s*$`, 'm').test(content)) {
					throw new Error('shared-property-registry-conflict')
				}
			}
		}
		await this.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
			frontmatter[SHARED_PROPERTIES_REGISTRY_MARKER] = true
			frontmatter['version'] = SHARED_PROPERTIES_REGISTRY_VERSION
			frontmatter['properties'] = clean.properties
		})
		this.lastKnownRegistry = clean
		this.preferLastKnownUntil = Date.now() + 500
	}

	async create(input: Omit<SharedPropertyDefinition, 'id'> & { id?: string }): Promise<SharedPropertyDefinition> {
		const registry = this.read()
		const definition = sanitizeSharedPropertyDefinition({ ...input, id: input.id ?? crypto.randomUUID() })
		if (!definition) throw new Error('invalid-shared-property')
		if (registry.properties.some(property => property.id === definition.id)) throw new Error('duplicate-shared-property-id')
		if (registry.properties.some(property => property.storageKey === definition.storageKey)) throw new Error('duplicate-shared-property-key')
		await this.write({ ...registry, properties: [...registry.properties, definition] })
		return definition
	}

	async update(definition: SharedPropertyDefinition, options: { allowOptionRemoval?: boolean } = {}): Promise<void> {
		const registry = this.read()
		const clean = sanitizeSharedPropertyDefinition(definition)
		if (!clean) throw new Error('invalid-shared-property')
		const existing = registry.properties.find(property => property.id === clean.id)
		if (!existing) throw new Error('missing-shared-property')
		if (existing.storageKey !== clean.storageKey || existing.type !== clean.type) throw new Error('immutable-shared-property-identity')
		if (!options.allowOptionRemoval && existing.options?.some(option => !clean.options?.some(candidate => candidate.value === option.value))) {
			throw new Error('shared-property-option-removal-requires-impact-scan')
		}
		if (registry.properties.some(property => property.id !== clean.id && property.storageKey === clean.storageKey)) {
			throw new Error('duplicate-shared-property-key')
		}
		await this.write({
			...registry,
			properties: registry.properties.map(property => property.id === clean.id ? clean : property),
		})
	}

	async remove(sharedPropertyId: string): Promise<void> {
		const registry = this.read()
		if (!registry.properties.some(property => property.id === sharedPropertyId)) throw new Error('missing-shared-property')
		await this.write({
			...registry,
			properties: registry.properties.filter(property => property.id !== sharedPropertyId),
		})
	}
}
