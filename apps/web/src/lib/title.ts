import { useEffect } from 'react'

/* Sets the document title for the current page; restores the plain site
   name when no specific title applies. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · dotavault` : 'dotavault'
  }, [title])
}
