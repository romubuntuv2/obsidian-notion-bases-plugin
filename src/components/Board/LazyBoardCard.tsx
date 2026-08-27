import React, { useEffect, useRef, useState } from 'react'

const CARD_ESTIMATED_HEIGHT = 60

export function LazyBoardCard({ children }: { children: React.ReactNode }) {
	const ref = useRef<HTMLDivElement>(null)
	const [visible, setVisible] = useState(false)
	const heightRef = useRef(CARD_ESTIMATED_HEIGHT)

	useEffect(() => {
		const element = ref.current
		if (!element) return
		const observer = new IntersectionObserver(([entry]) => {
			if (entry.isIntersecting) {
				setVisible(true)
				observer.disconnect()
			}
		}, { rootMargin: '200px 0px' })
		observer.observe(element)
		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (visible && ref.current) heightRef.current = ref.current.offsetHeight
	}, [visible])

	if (!visible) return <div ref={ref} style={{ minHeight: heightRef.current }} />
	return <div ref={ref}>{children}</div>
}
