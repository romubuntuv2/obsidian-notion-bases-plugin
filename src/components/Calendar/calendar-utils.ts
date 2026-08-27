import { NoteRow } from '../../types'
import { t } from '../../i18n'

export interface ParsedDateValue {
	year: number
	month: number
	day: number
	hour?: number
	minute?: number
}

export const daysShort = () => [
	t('day_mon'), t('day_tue'), t('day_wed'), t('day_thu'),
	t('day_fri'), t('day_sat'), t('day_sun'),
]

export const monthsLong = () => [
	t('month_january'), t('month_february'), t('month_march'),
	t('month_april'), t('month_may'), t('month_june'), t('month_july'),
	t('month_august'), t('month_september'), t('month_october'),
	t('month_november'), t('month_december'),
]

export function buildCalendarGrid(year: number, month: number): (number | null)[] {
	const firstDay = (new Date(year, month, 1).getDay() + 6) % 7
	const daysInMonth = new Date(year, month + 1, 0).getDate()
	const cells: (number | null)[] = []
	for (let i = 0; i < firstDay; i++) cells.push(null)
	for (let day = 1; day <= daysInMonth; day++) cells.push(day)
	while (cells.length % 7 !== 0) cells.push(null)
	return cells
}

export function buildWeekGrid(year: number, month: number, day: number): Date[] {
	const anchor = new Date(year, month, day)
	const dayOfWeek = (anchor.getDay() + 6) % 7
	const monday = new Date(anchor)
	monday.setDate(anchor.getDate() - dayOfWeek)
	return Array.from({ length: 7 }, (_, index) => {
		const date = new Date(monday)
		date.setDate(monday.getDate() + index)
		return date
	})
}

export function formatWeekRange(days: Date[]): string {
	if (days.length === 0) return ''
	const first = days[0]
	const last = days[6]
	const months = monthsLong()
	if (first.getMonth() === last.getMonth()) {
		return `${months[first.getMonth()]} ${first.getDate()} – ${last.getDate()}, ${first.getFullYear()}`
	}
	if (first.getFullYear() === last.getFullYear()) {
		return `${months[first.getMonth()]} ${first.getDate()} – ${months[last.getMonth()]} ${last.getDate()}, ${first.getFullYear()}`
	}
	return `${months[first.getMonth()]} ${first.getDate()}, ${first.getFullYear()} – ${months[last.getMonth()]} ${last.getDate()}, ${last.getFullYear()}`
}

export function dateKey(year: number, month: number, day: number): string {
	return `${year}-${month}-${day}`
}

export function formatTime(hour: number, minute: number): string {
	return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function parseDateValue(value: unknown): ParsedDateValue | null {
	if (!value || typeof value !== 'string') return null
	const timeIndex = value.indexOf('T')
	const parts = (timeIndex >= 0 ? value.slice(0, timeIndex) : value).split('-')
	if (parts.length !== 3) return null
	const year = parseInt(parts[0])
	const month = parseInt(parts[1]) - 1
	const day = parseInt(parts[2])
	if (isNaN(year) || isNaN(month) || isNaN(day)) return null
	if (timeIndex >= 0) {
		const timeParts = value.slice(timeIndex + 1).split(':')
		if (timeParts.length >= 2) {
			const hour = parseInt(timeParts[0])
			const minute = parseInt(timeParts[1])
			if (!isNaN(hour) && !isNaN(minute)) return { year, month, day, hour, minute }
		}
	}
	return { year, month, day }
}

export function getRowTime(row: NoteRow, fieldId: string): string | null {
	const parsed = parseDateValue((row as Record<string, unknown>)[fieldId])
	if (!parsed || parsed.hour === undefined || parsed.minute === undefined) return null
	return formatTime(parsed.hour, parsed.minute)
}
