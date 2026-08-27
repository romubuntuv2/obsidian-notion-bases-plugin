import React from 'react'
import { DatabaseMonthCell } from './DatabaseMonthCell'

interface DatabaseMonthWeekProps {
	week: (number | null)[]
	weekIndex: number
	cellProps: Omit<React.ComponentProps<typeof DatabaseMonthCell>, 'day'>
}

export function DatabaseMonthWeek({ week, weekIndex, cellProps }: DatabaseMonthWeekProps) {
	return <div className="nb-cal-monthly-week-row">
		{week.map((day, dayIndex) => <DatabaseMonthCell
			key={day ?? `empty-${weekIndex}-${dayIndex}`} day={day} {...cellProps} />)}
	</div>
}
