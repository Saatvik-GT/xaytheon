import { useEffect, useState } from 'react'

/** Hash routes (#/, #/lab/digits) so the app works from any static host path. */
export function useRoute(): string {
  const read = () => window.location.hash.replace(/^#/, '') || '/'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export function navigate(path: string) {
  if (window.location.hash.replace(/^#/, '') !== path) window.location.hash = path
}

export const labHref = (id: string) => `#/lab/${id}`
