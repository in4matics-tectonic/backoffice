// Bridge to the PoC showcase (poc-runner). When the backoffice runs in the showcase's iframe, the guided tour can
// log it in as the demo adviser and switch pages, and hears back when that happened. Only messages from the
// parent frame count, and they never carry credentials: the tour asks, the backoffice uses its own demo login.
import { useEffect } from 'react'

export type BridgeMsg =
  | { kateStudio: 'hello' }
  | { kateStudio: 'login' }
  | { kateStudio: 'page'; page: string; klantId?: string }

const framed = window.parent !== window

/** Tells the showcase something; the payload is UI state only (never tokens). */
export function tell(msg: Record<string, unknown>) {
  if (framed) window.parent.postMessage({ part: 'backoffice', ...msg }, '*')
}

export function useBridge(handle: (m: BridgeMsg) => void, deps: unknown[]) {
  useEffect(() => {
    if (!framed) return
    const on = (e: MessageEvent) => {
      if (e.source !== window.parent || typeof e.data?.kateStudio !== 'string') return
      handle(e.data as BridgeMsg)
    }
    addEventListener('message', on)
    return () => removeEventListener('message', on)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
