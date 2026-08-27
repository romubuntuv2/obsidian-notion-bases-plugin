import React from 'react'
import { NoteRow } from '../../types'

export type RowsByDate = Map<string, NoteRow[]>
export type DayClickHandler = (year: number, month: number, day: number) => Promise<void>
export type CardDragHandler = (event: React.DragEvent, row: NoteRow) => void
export type DayDragOverHandler = (event: React.DragEvent, day: number) => void
export type DayDragLeaveHandler = (event: React.DragEvent) => void
export type DayDropHandler = (event: React.DragEvent, year: number, month: number, day: number) => Promise<void>
