import { useLayoutEffect, useRef, useState } from 'react'

export type CardRect = { top: number; bottom: number; left: number; right: number; centerY: number }

// Measures each bracket card's position relative to the bracket's scrolling
// container, so connector lines can be drawn from real DOM positions rather
// than assumed symmetry. A single ResizeObserver watches the container and
// every registered card, re-measuring on any resize (viewport change, card
// width breakpoint, or a card expanding/collapsing to show its games).
export function useBracketLayout(seriesKeys: string[]) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const cardRefs = useRef(new Map<string, HTMLDivElement>())
  const cardRefCallbacks = useRef(new Map<string, (el: HTMLDivElement | null) => void>())
  const [positions, setPositions] = useState<Record<string, CardRect>>({})
  const [contentSize, setContentSize] = useState({ width: 0, height: 0 })

  const registerCard = (key: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(key, el)
    else cardRefs.current.delete(key)
  }

  // Returns a stable ref callback per card key instead of a fresh closure on
  // every render, so BracketCard (wrapped in React.memo) doesn't re-render
  // just because its `cardRef` prop identity changed.
  const getCardRef = (key: string) => {
    let cb = cardRefCallbacks.current.get(key)
    if (!cb) {
      cb = (el: HTMLDivElement | null) => registerCard(key, el)
      cardRefCallbacks.current.set(key, cb)
    }
    return cb
  }

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const measure = () => {
      const containerRect = container.getBoundingClientRect()
      const next: Record<string, CardRect> = {}
      for (const key of seriesKeys) {
        const el = cardRefs.current.get(key)
        if (!el) continue
        const rect = el.getBoundingClientRect()
        next[key] = {
          top: rect.top - containerRect.top,
          bottom: rect.bottom - containerRect.top,
          left: rect.left - containerRect.left,
          right: rect.right - containerRect.left,
          centerY: (rect.top + rect.bottom) / 2 - containerRect.top,
        }
      }
      setPositions(next)
      setContentSize({ width: container.scrollWidth, height: container.scrollHeight })
    }

    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(container)
    for (const el of cardRefs.current.values()) observer.observe(el)
    return () => observer.disconnect()
  }, [seriesKeys])

  return { containerRef, registerCard, getCardRef, positions, contentSize }
}
