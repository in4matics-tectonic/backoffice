import { useEffect, useRef, useState } from 'react'

/** Polls `fn` every `ms` (paused while the tab is hidden). Returns the last good value, so the UI doesn't flicker on a failed tick. */
export function usePoll<T>(fn: () => Promise<T>, ms: number, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState(false)
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout>
    setData(null)
    let eerste = true
    const tick = async () => {
      // Always load once; after that skip ticks while the tab is in the background
      if (eerste || document.visibilityState === 'visible') {
        eerste = false
        try {
          const v = await fnRef.current()
          if (alive) { setData(v); setError(false) }
        } catch {
          if (alive) setError(true)
        }
      }
      if (alive) timer = setTimeout(tick, ms)
    }
    tick()
    return () => { alive = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ms, ...deps])

  return { data, error }
}
