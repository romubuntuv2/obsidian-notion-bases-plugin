import { NoteRow } from '../../types'

export interface BoardColumnData {
	value: string
	label: string
	color?: string
	rows: NoteRow[]
}

export const DRAG_TYPE_CARD = 'nb-card'
export const DRAG_TYPE_COLUMN = 'nb-column'
export const VIRTUALIZATION_THRESHOLD = 30
