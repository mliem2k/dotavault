import { useState } from 'react'

export type SortDir = 'asc' | 'desc'

/* Click-to-sort state for a table: clicking the active column flips
   direction, clicking a new column switches to it at its default direction. */
export function useSort<K extends string>(initialKey: K, initialDir: SortDir = 'desc') {
  const [key, setKey] = useState<K>(initialKey)
  const [dir, setDir] = useState<SortDir>(initialDir)

  function onSort(k: K, defaultDir: SortDir = 'desc') {
    if (k === key) {
      setDir(dir === 'asc' ? 'desc' : 'asc')
    } else {
      setKey(k)
      setDir(defaultDir)
    }
  }

  return { key, dir, onSort }
}

export function applySort<T>(rows: T[], dir: SortDir, cmp: (a: T, b: T) => number): T[] {
  const sorted = [...rows].sort(cmp)
  return dir === 'asc' ? sorted : sorted.reverse()
}
