import { describe, expect, it, vi } from 'vitest'
import { App, TFile } from 'obsidian'
import { DatabaseManager } from '../src/database-manager'
import { ColumnSchema, DatabaseConfig, NoteRow, ViewConfig } from '../src/types'
import {
	getPropertyCapabilities,
	getFieldMenuColumns,
	getPropertyIcon,
	getViewPropertyColumns,
	getVisibleViewProperties,
	getVirtualPropertyDefinitions,
	isPropertyVisibleInView,
	migrateLegacyVirtualProperties,
	resolveEffectiveSchema,
	toggleViewProperty,
	updateVirtualProperty,
	VIRTUAL_PROPERTY_IDS,
} from '../src/virtual-properties'
import { applyFilters, applySorts, ActiveFilter } from '../src/components/filter-utils'
import { evaluateFormula } from '../src/formula-engine'
import { runtimePrefs } from '../src/runtime-prefs'

const localColumn = (overrides: Partial<ColumnSchema> = {}): ColumnSchema => ({
	id: 'status',
	name: 'Status',
	type: 'select',
	visible: true,
	...overrides,
})

function makeFile(): TFile {
	return Object.assign(new TFile(), {
		path: 'Projects/Website/Home.md',
		name: 'Home.md',
		basename: 'Home',
		parent: { path: 'Projects/Website' },
		stat: {
			ctime: new Date(2026, 0, 2, 9, 30).getTime(),
			mtime: new Date(2026, 0, 3, 10, 45).getTime(),
			size: 0,
		},
	})
}

function makeView(overrides: Partial<ViewConfig> = {}): ViewConfig {
	return {
		id: 'view', type: 'board', filters: [], sorts: [], hiddenColumns: [], columnWidths: {},
		...overrides,
	}
}

describe('virtual property catalog', () => {
	it('defines stable canonical IDs for every supported source', () => {
		expect(VIRTUAL_PROPERTY_IDS).toEqual({
			title: '_title',
			parentFolder: '_parentFolder',
			path: '_path',
			ctime: '_ctime',
			mtime: '_mtime',
		})
		const definitions = getVirtualPropertyDefinitions()
		expect(definitions.map(column => column.virtualSource)).toEqual([
			'title', 'parentFolder', 'path', 'ctime', 'mtime',
		])
		expect(definitions.every(column => column.propertyScope === 'virtual')).toBe(true)
	})

	it('marks title as the only editable virtual property', () => {
		const definitions = getVirtualPropertyDefinitions()
		const editable = definitions
			.filter(column => getPropertyCapabilities(column).editable)
			.map(column => column.virtualSource)
		expect(editable).toEqual(['title'])
		expect(definitions.every(column => !getPropertyCapabilities(column).persistedInFrontmatter)).toBe(true)
	})
})

describe('effective schema resolver', () => {
	it('keeps local definitions separate and injects virtual definitions', () => {
		const local = [localColumn()]
		const resolved = resolveEffectiveSchema(local)
		expect(resolved.localSchema).toHaveLength(1)
		expect(resolved.localSchema[0].propertyScope).toBe('database')
		expect(resolved.virtualSchema).toHaveLength(5)
		expect(resolved.schema).toHaveLength(6)
		expect(local[0].propertyScope).toBeUndefined()
	})

	it('reports reserved ID collisions without duplicating a column', () => {
		const resolved = resolveEffectiveSchema([localColumn({ id: '_path', name: 'Legacy path' })])
		expect(resolved.reservedIdCollisions).toEqual(['_path'])
		expect(resolved.schema.filter(column => column.id === '_path')).toHaveLength(1)
		expect(resolved.schema.find(column => column.id === '_path')?.virtualSource).toBe('path')
		expect(resolved.localSchema.find(column => column.id === '_path')?.name).toBe('Legacy path')
	})

	it('preserves legacy system timestamp columns alongside canonical virtual timestamps', () => {
		const resolved = resolveEffectiveSchema([
			localColumn({ id: 'created', name: 'Created', type: 'date', systemField: 'ctime' }),
		])
		expect(resolved.schema.some(column => column.id === 'created' && column.systemField === 'ctime')).toBe(true)
		expect(resolved.schema.some(column => column.id === '_ctime' && column.virtualSource === 'ctime')).toBe(true)
	})
})

describe('legacy virtual-property migration', () => {
	it('migrates timestamp definitions and every compatible view reference exactly once', () => {
		const legacyConfig: DatabaseConfig = {
			schema: [
				localColumn({ id: 'created', name: 'Created', type: 'date', systemField: 'ctime' }),
				localColumn({ id: 'edited', name: 'Edited', type: 'date', systemField: 'mtime' }),
				localColumn({ id: 'age', name: 'Age', type: 'formula', formula: 'CONCAT([created], edited)' }),
			],
			views: [makeView({
				includeSubfolders: true,
				virtualColumnIds: ['created'],
				hiddenColumns: ['edited', '_folder'],
				filters: [{ id: 'f', columnId: 'created', operator: 'is_not_empty', value: '' }],
				sorts: [{ columnId: 'edited', direction: 'desc' }],
				activePills: [{ id: 'p', columnId: 'created', operator: 'is_not_empty', value: '' }],
				columnOrder: ['created', 'age', '_folder'],
				columnWidths: { created: 180, edited: 190, _folder: 150 },
				aggregations: { created: 'count' },
				conditionalFormats: [{ id: 'cf', columnId: 'edited', operator: 'is_not_empty', value: '', bgColor: '#000', textColor: '#fff' }],
				pinnedColumnId: 'created',
				calendarDateField: 'created',
				timelineStartField: 'created',
				timelineEndField: 'edited',
				chartXAxis: 'created',
			})],
		}

		const migration = migrateLegacyVirtualProperties(legacyConfig)
		expect(migration.migrated).toBe(true)
		expect(migration.config.schema.map(column => column.id)).toEqual(['age'])
		expect(migration.config.schema[0].formula).toBe('CONCAT([_ctime], _mtime)')
		const view = migration.config.views[0]
		expect(view.virtualColumnIds).toEqual(['_ctime'])
		expect(view.filters[0].columnId).toBe('_ctime')
		expect(view.sorts[0].columnId).toBe('_mtime')
		expect(view.activePills?.[0].columnId).toBe('_ctime')
		expect(view.columnOrder).toEqual(['_ctime', 'age', '_parentFolder'])
		expect(view.columnWidths).toEqual({ _ctime: 180, _mtime: 190, _parentFolder: 150 })
		expect(view.aggregations).toEqual({ _ctime: 'count' })
		expect(view.conditionalFormats?.[0].columnId).toBe('_mtime')
		expect(view.pinnedColumnId).toBe('_ctime')
		expect(view.calendarDateField).toBeUndefined()
		expect(view.timelineStartField).toBeUndefined()
		expect(view.timelineEndField).toBeUndefined()
		expect(view.chartXAxis).toBe('_ctime')
		expect(migrateLegacyVirtualProperties(migration.config).migrated).toBe(false)
	})

	it('does not select a legacy timestamp that was hidden in a view', () => {
		const result = migrateLegacyVirtualProperties({
			schema: [localColumn({ id: 'created', type: 'date', systemField: 'ctime' })],
			views: [makeView({ hiddenColumns: ['created'] })],
		})
		expect(result.config.views[0].virtualColumnIds).toEqual([])
	})
})

describe('view exposure', () => {
	it('offers the four read-only virtual properties without duplicating title', () => {
		const schema = resolveEffectiveSchema([localColumn()]).schema
		expect(getViewPropertyColumns(schema).map(column => column.id)).toEqual([
			'status', '_parentFolder', '_path', '_ctime', '_mtime',
		])
	})

	it('uses dedicated folder and path icons', () => {
		const schema = resolveEffectiveSchema([]).schema
		expect(getPropertyIcon(schema.find(column => column.id === '_parentFolder')!)).toBe('📁')
		expect(getPropertyIcon(schema.find(column => column.id === '_path')!)).toBe('🧭')
	})

	it('filters only Fields-menu choices through global preferences', () => {
		const schema = resolveEffectiveSchema([localColumn()]).schema
		expect(getFieldMenuColumns(schema).map(column => column.id)).toEqual(['status', '_parentFolder', '_path'])
		runtimePrefs.virtualPropertyMenuVisibility.ctime = true
		try {
			expect(getFieldMenuColumns(schema).map(column => column.id)).toEqual(['status', '_parentFolder', '_path', '_ctime'])
			// Effective consumers still retain every canonical property.
			expect(getViewPropertyColumns(schema).map(column => column.id)).toContain('_mtime')
		} finally {
			runtimePrefs.virtualPropertyMenuVisibility.ctime = false
		}
	})

	it('keeps virtual properties hidden until the current view selects them', () => {
		const schema = resolveEffectiveSchema([localColumn()]).schema
		const parent = schema.find(column => column.id === '_parentFolder')!
		const initialView = makeView()
		expect(getVisibleViewProperties(schema, initialView).map(column => column.id)).toEqual(['status'])
		expect(isPropertyVisibleInView(parent, initialView)).toBe(false)

		const selectedView = toggleViewProperty(initialView, parent)
		expect(selectedView.virtualColumnIds).toEqual(['_parentFolder'])
		expect(selectedView.hiddenColumns).toEqual([])
		expect(getVisibleViewProperties(schema, selectedView).map(column => column.id)).toEqual(['status', '_parentFolder'])
	})

	it('keeps local visibility and virtual selection in separate view settings', () => {
		const schema = resolveEffectiveSchema([localColumn()]).schema
		const local = schema.find(column => column.id === 'status')!
		const virtual = schema.find(column => column.id === '_path')!
		const withVirtual = toggleViewProperty(makeView(), virtual)
		const withLocalHidden = toggleViewProperty(withVirtual, local)
		expect(withLocalHidden.virtualColumnIds).toEqual(['_path'])
		expect(withLocalHidden.hiddenColumns).toEqual(['status'])
	})
})

describe('virtual row values and mutations', () => {
	it('hydrates every canonical value from TFile metadata', () => {
		const app = { metadataCache: { getFileCache: () => ({ frontmatter: {} }) } } as unknown as App
		const manager = new DatabaseManager(app, '_database.md')
		const row = manager.getNoteDataSync(makeFile(), resolveEffectiveSchema([]).schema)
		expect(row._title).toBe('Home')
		expect(row._parentFolder).toBe('Projects/Website')
		expect(row._path).toBe('Projects/Website/Home.md')
		expect(row._ctime).toBe('2026-01-02T09:30')
		expect(row._mtime).toBe('2026-01-03T10:45')
	})

	it('routes title edits to renameNote and rejects every read-only source', async () => {
		const renameNote = vi.fn(async () => undefined)
		const manager = { renameNote } as unknown as Pick<DatabaseManager, 'renameNote'>
		const file = makeFile()
		expect(await updateVirtualProperty(manager, file, 'title', 'New title')).toBe(true)
		expect(renameNote).toHaveBeenCalledWith(file, 'New title')

		for (const source of ['parentFolder', 'path', 'ctime', 'mtime'] as const) {
			expect(await updateVirtualProperty(manager, file, source, 'ignored')).toBe(false)
		}
		expect(renameNote).toHaveBeenCalledTimes(1)
	})

	it('supports filtering, sorting, and formulas through canonical IDs', () => {
		const schema = resolveEffectiveSchema([]).schema
		const fileA = makeFile()
		const fileB = Object.assign(makeFile(), { path: 'Archive/Old.md', parent: { path: 'Archive' }, basename: 'Old' })
		const rows: NoteRow[] = [
			{ _file: fileA, _title: 'Home', _parentFolder: 'Projects/Website', _path: fileA.path },
			{ _file: fileB, _title: 'Old', _parentFolder: 'Archive', _path: fileB.path },
		]
		const filter: ActiveFilter = { id: 'folder', columnId: '_parentFolder', columnName: 'Folder',
			columnType: 'text', icon: 'Aa', operator: 'contains', value: 'projects', conjunction: 'and' }
		expect(applyFilters(rows, [filter]).map(row => row._title)).toEqual(['Home'])
		expect(applySorts(rows, [{ columnId: '_path', direction: 'asc' }]).map(row => row._title)).toEqual(['Old', 'Home'])
		expect(evaluateFormula('CONCAT(_parentFolder, "/", _title)', rows[0], rows, schema)).toBe('Projects/Website/Home')
	})
})
