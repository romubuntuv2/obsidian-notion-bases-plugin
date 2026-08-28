import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../../i18n'

const COLOR_PALETTE = [
	'#9E9E9E', '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5',
	'#2196F3', '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A',
	'#FFEB3B', '#FF9800', '#FF5722', '#795548',
]

interface SelectorOptionColorPickerProps {
	color: string
	onChange: (color: string) => Promise<void>
}

export function SelectorOptionColorPicker({ color, onChange }: SelectorOptionColorPickerProps) {
	const [open, setOpen] = useState(false)
	const [position, setPosition] = useState({ top: 0, left: 0 })
	const anchorRef = useRef<HTMLButtonElement>(null)
	const pickerRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		if (!open) return
		const document = anchorRef.current?.ownerDocument ?? activeDocument
		const close = (event: MouseEvent) => {
			const target = event.target as Node
			if (!anchorRef.current?.contains(target) && !pickerRef.current?.contains(target)) setOpen(false)
		}
		document.addEventListener('mousedown', close)
		return () => document.removeEventListener('mousedown', close)
	}, [open])

	const picker = open ? createPortal(
		<div ref={pickerRef} className="nb-status-color-picker"
			style={{ position: 'fixed', top: position.top, left: position.left, zIndex: 10000 }}
			onMouseDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()}>
			<div className="nb-status-color-grid">
				{COLOR_PALETTE.map(candidate => <button key={candidate} className="nb-status-color-dot"
					style={{ background: candidate }} title={candidate}
					onClick={() => { void onChange(candidate) }} />)}
			</div>
			<div className="nb-status-color-custom">
				<label className="nb-status-color-custom-label">
					{t('color_custom')}
					<input type="color" className="nb-status-color-input" value={color}
						onChange={event => { void onChange(event.target.value) }} />
				</label>
			</div>
		</div>,
		anchorRef.current?.ownerDocument.body ?? activeDocument.body,
	) : null

	return <>
		<button ref={anchorRef} className={`nb-status-color-swatch${open ? ' nb-status-color-swatch--active' : ''}`}
			title={t('tooltip_change_color')} style={{ background: color }}
			onClick={event => {
				event.stopPropagation()
				const rect = event.currentTarget.getBoundingClientRect()
				const viewportWidth = event.currentTarget.ownerDocument.defaultView?.innerWidth ?? window.innerWidth
				setPosition({ top: rect.bottom + 4, left: Math.min(rect.right - 176, viewportWidth - 184) })
				setOpen(current => !current)
			}} />
		{picker}
	</>
}
