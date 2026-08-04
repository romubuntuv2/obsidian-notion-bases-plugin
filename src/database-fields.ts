import { ColumnSchema, DatabaseField } from "types"


export interface DatabaseFieldContext {
	includeSubfolders: boolean
}

export function getAvailableFields(
	schema: ColumnSchema[],
	_context: DatabaseFieldContext
): DatabaseField[] {
	// Pour l'instant on ne fait qu'adapter les ColumnSchema.
	return schema.map(field => ({
		...field,
		source: 'local',
	}))
}