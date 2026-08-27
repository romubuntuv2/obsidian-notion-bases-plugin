import React from 'react'
import { daysShort } from './calendar-utils'
import { DatabaseMonthCell } from './DatabaseMonthCell'
import { DatabaseMonthWeek } from './DatabaseMonthWeek'

interface DatabaseMonthViewProps {
	calendarCells: (number | null)[]
	cellProps: Omit<React.ComponentProps<typeof DatabaseMonthCell>, 'day'>
}

export function DatabaseMonthView({ calendarCells, cellProps }: DatabaseMonthViewProps) {
	const weeks = Array.from({ length: Math.ceil(calendarCells.length / 7) }, (_, index) =>
		calendarCells.slice(index * 7, index * 7 + 7))
	return <div className="nb-cal-monthly-grid">
		{daysShort().map(day => <div key={day} className="nb-cal-monthly-day-header">{day}</div>)}
		{weeks.map((week, index) => <DatabaseMonthWeek key={index} week={week} weekIndex={index} cellProps={cellProps} />)}
	</div>
}
