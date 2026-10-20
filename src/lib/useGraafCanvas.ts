import { useEffect, useRef, useState } from 'react'
import { forceSimulation, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import type { LinkStatus } from '../types'

// Shared canvas for the force graphs: runs the d3 simulation, keeps node positions across re-layouts, fits the
// view while the user hasn't zoomed or panned, and handles wheel zoom, panning, dragging and clicking a node.

export interface GraafKnoop extends SimulationNodeDatum { id: string }
type Punt = { x: number; y: number; vx?: number; vy?: number }
type Zicht = { k: number; x: number; y: number }

export const knoopId = (n: string | number | GraafKnoop) => (typeof n === 'object' ? n.id : String(n))
/** Small deterministic jitter, so a layout starts from the same place every time. */
export const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

export const STATUSSEN: LinkStatus[] = ['actief', 'gekend', 'mogelijk']
export const NAVY = '#0d2a50'
export const kort = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

// ---- Flowers: only hubs are simulated, their products and partners sit on a fixed ring around them ----

export interface BloemKnoop extends GraafKnoop {
  r: number
  bloem?: BloemKnoop[]
  bloemStraal?: number
  /** Angle on its hub's ring, for a label that points outward. */
  hoek?: number
}

/** The ring leaves this opening at the top, where the hub's label goes. */
const OPENING = Math.PI / 3

/** Ring radius that fits every petal (its diameter plus a gap) on the ring outside the opening. */
export const ringStraal = (bloem: { r: number }[]) => Math.max(24, bloem.reduce((s, k) => s + 2 * k.r + 7, 0) / (2 * Math.PI - OPENING))

/** Puts the petals of every hub on its ring. Call on every render, after the simulation moved the hubs. */
export function plaatsBloemen<K extends BloemKnoop & { bloem?: K[] }>(hubs: K[], toon: (k: K) => boolean = () => true) {
  for (const h of hubs) {
    if (!h.bloem || h.x == null) continue
    const blad = h.bloem.filter(toon)
    blad.forEach((k, i) => {
      k.hoek = -Math.PI / 2 + OPENING / 2 + ((i + 0.5) / blad.length) * (2 * Math.PI - OPENING)
      k.x = h.x! + Math.cos(k.hoek) * h.bloemStraal!
      k.y = h.y! + Math.sin(k.hoek) * h.bloemStraal!
    })
  }
}

/** Label position: outward along the ring for a petal, centred under the node otherwise. */
export function labelBij(k: { r: number; hoek?: number }, tekst: number, onder = 3) {
  if (k.hoek == null) return { x: 0, y: k.r + onder + tekst, anker: 'middle' as const }
  const c = Math.cos(k.hoek), s = Math.sin(k.hoek), d = k.r + 4
  if (Math.abs(c) > 0.3) return { x: c * d, y: s * d + tekst * 0.35, anker: c > 0 ? 'start' as const : 'end' as const }
  return { x: 0, y: s > 0 ? d + tekst * 0.85 : -d - tekst * 0.25, anker: 'middle' as const }
}

const ZOOM_MIN = 0.35, ZOOM_MAX = 3
const klem = (k: number) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k))

export function useGraafCanvas<K extends GraafKnoop, L extends SimulationLinkDatum<K>>({ graaf, krachten, maxHoogte = 640, vul = false, sleepbaar = () => true, omvang = () => 0, kies }: {
  /** Memoize it: a new object means a new layout (starting from the old positions). */
  graaf: { knopen: K[]; lijnen: L[] }
  /** Adds the forces to a fresh simulation. */
  krachten: (s: Simulation<K, L>, lijnen: L[]) => void
  /** Height follows the width (the layouts are roughly round), capped here. Ignored with `vul`. */
  maxHoogte?: number
  /** Fill the container's height instead (full-screen view). */
  vul?: boolean
  sleepbaar?: (k: K) => boolean
  /** Extra radius drawn around a node outside the simulation, so fitting the view keeps it in frame. */
  omvang?: (k: K) => number
  /** Click (not drag) on a node, or on the empty canvas with null. */
  kies: (k: K | null) => void
}) {
  const wrap = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const posities = useRef(new Map<string, Punt>())
  const sim = useRef<Simulation<K, L> | null>(null)
  const [, setTick] = useState(0)
  const [maat, setMaat] = useState({ b: 800, h: 0 })
  const breedte = maat.b
  const hoogte = vul ? Math.max(360, Math.round(maat.h)) : Math.round(Math.min(maxHoogte, Math.max(360, breedte * 0.8)))
  const [zicht, setZicht] = useState<Zicht>({ k: 1, x: 0, y: 0 })
  const handmatig = useRef(false) // user zoomed or panned: stop auto-fitting
  const actueel = useRef({ b: breedte, h: hoogte, knopen: graaf.knopen, krachten, kies, sleepbaar, omvang })
  useEffect(() => { actueel.current = { b: breedte, h: hoogte, knopen: graaf.knopen, krachten, kies, sleepbaar, omvang } })

  /** Zoom and offset that fit every node of the current graph (plus room for labels) in the frame. */
  const pasIn = (): Zicht => {
    const { b, h, knopen, omvang } = actueel.current
    const ps = knopen.filter((k) => k.x != null)
    if (!ps.length) return { k: 1, x: 0, y: 0 }
    const [x0, x1, y0, y1] = [
      Math.min(...ps.map((p) => p.x! - omvang(p))) - 70, Math.max(...ps.map((p) => p.x! + omvang(p))) + 70,
      Math.min(...ps.map((p) => p.y! - omvang(p))) - 30, Math.max(...ps.map((p) => p.y! + omvang(p))) + 40,
    ]
    const k = Math.min(1.4, Math.max(ZOOM_MIN, Math.min(b / (x1 - x0), h / (y1 - y0))))
    return { k, x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k }
  }

  useEffect(() => {
    const { knopen, lijnen } = graaf
    for (const k of knopen) {
      const p = posities.current.get(k.id)
      if (p && k.fx == null) Object.assign(k, p)
    }
    const s = forceSimulation(knopen).alpha(posities.current.size ? 0.5 : 1)
    actueel.current.krachten(s, lijnen)
    s.on('tick', () => {
      for (const k of knopen) posities.current.set(k.id, { x: k.x!, y: k.y!, vx: k.vx, vy: k.vy })
      if (!handmatig.current) setZicht(pasIn())
      setTick((t) => t + 1)
    })
    sim.current = s
    return () => { s.stop() }
  }, [graaf]) // eslint-disable-line react-hooks/exhaustive-deps

  // Refit when the frame changes size (e.g. opening full screen), unless the user took over
  useEffect(() => { if (!handmatig.current) setZicht(pasIn()) }, [breedte, hoogte]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setMaat({ b: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Wheel zoom around the cursor (needs a non-passive listener)
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const op = (e: WheelEvent) => {
      e.preventDefault()
      handmatig.current = true
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left - rect.width / 2
      const my = e.clientY - rect.top - rect.height / 2
      setZicht((z) => {
        const k = klem(z.k * Math.exp(-e.deltaY * 0.0015))
        return { k, x: mx - ((mx - z.x) * k) / z.k, y: my - ((my - z.y) * k) / z.k }
      })
    }
    el.addEventListener('wheel', op, { passive: false })
    return () => el.removeEventListener('wheel', op)
  }, [])

  const naarGraaf = (e: { clientX: number; clientY: number }) => {
    const rect = svg.current!.getBoundingClientRect()
    return { x: (e.clientX - rect.left - rect.width / 2 - zicht.x) / zicht.k, y: (e.clientY - rect.top - rect.height / 2 - zicht.y) / zicht.k }
  }

  // Drag a node, or pan the canvas
  const sleep = useRef<{ knoop?: K; start: { x: number; y: number }; zicht: Zicht; bewogen: boolean } | null>(null)
  const omlaag = (e: React.PointerEvent, knoop?: K) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    sleep.current = { knoop, start: { x: e.clientX, y: e.clientY }, zicht, bewogen: false }
    if (knoop && actueel.current.sleepbaar(knoop)) sim.current?.alphaTarget(0.25).restart()
  }
  const beweeg = (e: React.PointerEvent) => {
    const s = sleep.current
    if (!s) return
    if (Math.abs(e.clientX - s.start.x) + Math.abs(e.clientY - s.start.y) > 3) s.bewogen = true
    if (s.knoop && actueel.current.sleepbaar(s.knoop)) {
      const p = naarGraaf(e)
      s.knoop.fx = p.x
      s.knoop.fy = p.y
    } else if (!s.knoop) {
      handmatig.current = true
      setZicht({ ...s.zicht, x: s.zicht.x + e.clientX - s.start.x, y: s.zicht.y + e.clientY - s.start.y })
    }
  }
  const omhoog = () => {
    const s = sleep.current
    sleep.current = null
    if (!s) return
    if (s.knoop && actueel.current.sleepbaar(s.knoop)) { s.knoop.fx = null; s.knoop.fy = null; sim.current?.alphaTarget(0) }
    if (!s.bewogen) actueel.current.kies(s.knoop ?? null)
  }

  /** Pointer position relative to the frame, for tooltips. */
  const naarScherm = (e: React.PointerEvent) => {
    const rect = wrap.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  return {
    wrap, svg, breedte, hoogte, zicht, naarScherm,
    /** Frame style: a fixed height, or none when it fills its container. */
    wrapStijl: vul ? undefined : { height: hoogte },
    transform: `translate(${breedte / 2 + zicht.x},${hoogte / 2 + zicht.y}) scale(${zicht.k})`,
    svgProps: { onPointerDown: (e: React.PointerEvent) => omlaag(e), onPointerMove: beweeg, onPointerUp: omhoog },
    knoopOmlaag: omlaag,
    zoom: (f: number) => { handmatig.current = true; setZicht((z) => { const k = klem(z.k * f); return { k, x: (z.x * k) / z.k, y: (z.y * k) / z.k } }) },
    pas: () => { handmatig.current = false; setZicht(pasIn()) },
  }
}
