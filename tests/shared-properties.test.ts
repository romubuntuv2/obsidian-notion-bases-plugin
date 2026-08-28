import { describe, expect, it } from 'vitest'
import { App, TFile } from 'obsidian'
import { DatabaseConfig, SharedPropertyDefinition, SharedPropertyRegistry, ViewConfig } from '../src/types'
import {
	attachSharedProperty,
	appendSelectorOption,
	detachSharedProperty,
	findMissingSharedPropertyReferences,
	getSharedPropertyAttachmentError,
	renameSelectorOption,
	recolorSelectorOption,
	resolveRenamedOptionValue,
	resolveSharedOptionRemovalValue,
	resolveAttachedSharedProperties,
	sanitizeSharedPropertyRegistry,
	sharedDefinitionToLocalColumn,
	sharedValueContainsOption,
	SHARED_PROPERTIES_REGISTRY_MARKER,
	SHARED_PROPERTIES_REGISTRY_PATH,
	SharedPropertyRegistryStore,
} from '../src/shared-properties'
import { resolveEffectiveSchema } from '../src/virtual-properties'

const sharedType: SharedPropertyDefinition = {
	id: 'shared-type',
	storageKey: 'type',
	name: 'Type',
	type: 'select',
	options: [{ value: 'Todo', color: '#f00' }, { value: 'Post', color: '#0f0' }],
}

const registry = (properties: SharedPropertyDefinition[] = [sharedType]): SharedPropertyRegistry => ({
	version: 1,
	properties,
})

const view = (): ViewConfig => ({
	id: 'view', type: 'table', filters: [], sorts: [], hiddenColumns: [], columnWidths: {},
})

const config = (overrides: Partial<DatabaseConfig> = {}): DatabaseConfig => ({
	schema: [], views: [view()], sharedPropertyIds: [], ...overrides,
})

describe('shared-property registry model', () => {
	it('sanitizes malformed definitions and duplicate IDs or storage keys', () => {
		const clean = sanitizeSharedPropertyRegistry({
			version: 1,
			properties: [
				sharedType,
				{ ...sharedType, name: 'Duplicate ID', storageKey: 'other' },
				{ ...sharedType, id: 'other-id', name: 'Duplicate key' },
				{ id: '', storageKey: 'bad', name: 'Bad', type: 'select' },
			],
		})
		expect(clean.properties).toEqual([sharedType])
	})

	it('resolves references in database order and reports missing definitions', () => {
		const second = { ...sharedType, id: 'priority-id', storageKey: 'priority', name: 'Priority' }
		const result = resolveAttachedSharedProperties(registry([sharedType, second]), ['priority-id', 'missing', 'shared-type'])
		expect(result.columns.map(column => column.id)).toEqual(['priority', 'type'])
		expect(result.columns.every(column => column.propertyScope === 'shared')).toBe(true)
		expect(result.missingReferenceIds).toEqual(['missing'])
	})

	it('audits missing vault references and deduplicates each database entry', () => {
		expect(findMissingSharedPropertyReferences(registry(), [
			{ path: 'Projects/First.md', sharedPropertyIds: [sharedType.id, 'missing', 'missing'] },
			{ path: 'Projects/Second.md', sharedPropertyIds: ['other-missing'] },
		])).toEqual([
			{ databasePath: 'Projects/First.md', sharedPropertyId: 'missing' },
			{ databasePath: 'Projects/Second.md', sharedPropertyId: 'other-missing' },
		])
	})

	it('blocks local storage-key collisions without mutating the database', () => {
		const database = config({
			schema: [{ id: 'type', name: 'Local type', type: 'text', visible: true }],
		})
		expect(getSharedPropertyAttachmentError(database, registry(), sharedType.id)).toBe('local-collision')
		expect(() => attachSharedProperty(database, registry(), sharedType.id)).toThrow('local-collision')
		expect(database.sharedPropertyIds).toEqual([])
	})

	it('attaches and detaches references without copying definitions into local schema', () => {
		const database = config()
		const attached = attachSharedProperty(database, registry(), sharedType.id)
		expect(attached.sharedPropertyIds).toEqual([sharedType.id])
		expect(attached.schema).toEqual([])
		expect(detachSharedProperty(attached, sharedType.id).sharedPropertyIds).toEqual([])
	})
})

describe('shared effective schema', () => {
	it('composes local, attached shared, and virtual definitions', () => {
		const attached = resolveAttachedSharedProperties(registry(), [sharedType.id])
		const effective = resolveEffectiveSchema(
			[{ id: 'priority', name: 'Priority', type: 'number', visible: true }],
			attached.columns,
		)
		expect(effective.schema.map(column => column.id)).toEqual([
			'priority', 'type', '_title', '_parentFolder', '_path', '_ctime', '_mtime',
		])
		expect(effective.schema.find(column => column.id === 'type')?.options).toEqual(sharedType.options)
	})

	it('reflects one canonical option update for every attached database', () => {
		const first = config({ sharedPropertyIds: [sharedType.id] })
		const second = config({ sharedPropertyIds: [sharedType.id] })
		const updatedRegistry = registry([{
			...sharedType,
			options: [...(sharedType.options ?? []), { value: 'Event', color: '#00f' }],
		}])
		for (const database of [first, second]) {
			const attached = resolveAttachedSharedProperties(updatedRegistry, database.sharedPropertyIds)
			const column = resolveEffectiveSchema(database.schema, attached.columns).schema.find(candidate => candidate.id === 'type')
			expect(column?.options?.map(option => option.value)).toEqual(['Todo', 'Post', 'Event'])
		}
	})
})

describe('shared-property destructive migrations', () => {
	it('appends a normalized option while preserving the existing catalog', () => {
		expect(appendSelectorOption(sharedType.options, { value: ' Event ', color: '#00f' })).toEqual([
			...(sharedType.options ?? []),
			{ value: 'Event', color: '#00f' },
		])
		expect(() => appendSelectorOption(sharedType.options, { value: 'Todo' })).toThrow('duplicate-selector-option')
	})

	it('recolors one option without mutating names or order', () => {
		expect(recolorSelectorOption(sharedType.options, 'Todo', '#123456')).toEqual([
			{ value: 'Todo', color: '#123456' },
			{ value: 'Post', color: '#0f0' },
		])
	})

	it('renames an option without losing its color or position', () => {
		expect(renameSelectorOption(sharedType.options, 'Todo', 'Task')).toEqual([
			{ value: 'Task', color: '#f00' },
			{ value: 'Post', color: '#0f0' },
		])
		expect(() => renameSelectorOption(sharedType.options, 'Todo', 'Post')).toThrow('duplicate-selector-option')
		expect(() => renameSelectorOption(sharedType.options, 'Todo', '   ')).toThrow('invalid-selector-option-name')
	})

	it('renames scalar and multiselect note values and deduplicates collisions', () => {
		expect(resolveRenamedOptionValue('Todo', 'Todo', 'Task')).toBe('Task')
		expect(resolveRenamedOptionValue(['Todo', 'Post'], 'Todo', 'Task')).toEqual(['Task', 'Post'])
		expect(resolveRenamedOptionValue(['Todo', 'Task'], 'Todo', 'Task')).toEqual(['Task'])
	})

	it('detects scalar and multiselect option usage', () => {
		expect(sharedValueContainsOption('Todo', 'Todo')).toBe(true)
		expect(sharedValueContainsOption(['Post', 'Todo'], 'Todo')).toBe(true)
		expect(sharedValueContainsOption(['Post'], 'Todo')).toBe(false)
	})

	it('replaces, clears, or preserves scalar values explicitly', () => {
		expect(resolveSharedOptionRemovalValue('Todo', 'Todo', 'replace', 'Post')).toBe('Post')
		expect(resolveSharedOptionRemovalValue('Todo', 'Todo', 'clear')).toBeNull()
		expect(resolveSharedOptionRemovalValue('Todo', 'Todo', 'preserve')).toBe('Todo')
		expect(resolveSharedOptionRemovalValue('Post', 'Todo', 'clear')).toBe('Post')
	})

	it('migrates multiselect values without duplicates and clears an empty result', () => {
		expect(resolveSharedOptionRemovalValue(['Todo', 'Post'], 'Todo', 'replace', 'Post')).toEqual(['Post'])
		expect(resolveSharedOptionRemovalValue(['Todo', 'Event'], 'Todo', 'clear')).toEqual(['Event'])
		expect(resolveSharedOptionRemovalValue(['Todo'], 'Todo', 'clear')).toBeNull()
	})

	it('converts the final shared definition into an independent local column', () => {
		const local = sharedDefinitionToLocalColumn(sharedType)
		expect(local).toMatchObject({ id: 'type', name: 'Type', type: 'select', visible: true })
		expect(local.options).toEqual(sharedType.options)
		expect(local.propertyScope).toBeUndefined()
		expect(local.sharedPropertyId).toBeUndefined()
	})
})

describe('shared-property registry persistence', () => {
	it('creates the vault-root registry and writes canonical frontmatter', async () => {
		let registryFile: TFile | null = null
		let createdContent = ''
		const frontmatter: Record<string, unknown> = {}
		const app = {
			vault: {
				getFileByPath: () => registryFile,
				create: async (path: string, content: string) => {
					registryFile = Object.assign(new TFile(), { path, name: path, basename: path.replace(/\.md$/, '') })
					createdContent = content
					return registryFile
				},
			},
			metadataCache: { getFileCache: () => ({ frontmatter }) },
			fileManager: {
				processFrontMatter: async (_file: TFile, update: (value: Record<string, unknown>) => void) => update(frontmatter),
			},
		} as unknown as App
		const store = new SharedPropertyRegistryStore(app)
		await store.create({ ...sharedType, id: sharedType.id })
		expect(registryFile?.path).toBe(SHARED_PROPERTIES_REGISTRY_PATH)
		expect(createdContent).toContain(`${SHARED_PROPERTIES_REGISTRY_MARKER}: true`)
		expect(frontmatter[SHARED_PROPERTIES_REGISTRY_MARKER]).toBe(true)
		expect(frontmatter['properties']).toEqual([sharedType])
		const withEvent = { ...sharedType, options: [...(sharedType.options ?? []), { value: 'Event', color: '#00f' }] }
		await store.update(withEvent)
		expect(frontmatter['properties']).toEqual([withEvent])
		await expect(store.update(sharedType))
			.rejects.toThrow('shared-property-option-removal-requires-impact-scan')
		expect(frontmatter['properties']).toEqual([withEvent])
		await store.update(sharedType, { allowOptionRemoval: true })
		expect(frontmatter['properties']).toEqual([sharedType])
		await store.remove(sharedType.id)
		expect(frontmatter['properties']).toEqual([])
	})
})
