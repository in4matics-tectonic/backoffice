import { useEffect, useMemo, useRef, useState } from 'react'
import { forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type Simulation, type SimulationLinkDatum, type SimulationNodeDatum } from 'd3-force'
import { Maximize2, Minus, Plus } from 'lucide-react'
import type { Ecosystemen, Link, LinkStatus, MomentId } from '../types'
import { HERKOMST_LABEL, LINK_KLEUR, LINK_LABEL, LINK_STREEP, MOMENT_LABEL, pct } from '../lib/labels'

// "Obsidian brain" of one customer: the customer in the middle, one hub per ecosystem cluster, and every
// active, known and possible link around its hub. Thin amber lines are the reasoning behind a possible link.

type Soort = 'klant' | 'hub' | 'link' | 'moment'
interface Knoop extends SimulationNodeDatum {
  id: string
  soort: Soort
  naam: string
  r: number
  status?: LinkStatus
  link?: Link
}
interface Lijn extends SimulationLinkDatum<Knoop> {
  id: string
  soort: 'structuur' | 'verband'
  status?: LinkStatus
  afstand: number
}
type Punt = { x: number; y: number; vx?: number; vy?: number }

const NAVY = '#0d2a50'
const STATUSSEN: LinkStatus[] = ['actief', 'gekend', 'mogelijk']
const id = (n: string | number | Knoop) => (typeof n === 'object' ? n.id : String(n))
// Small deterministic jitter so a re-layout starts from the same place every time
const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7)

function bouwGraaf(data: Ecosystemen, klantNaam: string) {
  const knopen: Knoop[] = [{ id: 'klant', soort: 'klant', naam: klantNaam, r: 15, fx: 0, fy: 0 }]
  const lijnen: Lijn[] = []
  const n = data.clusters.length
  data.clusters.forEach((c, i) => {
    const hub = `eco:${c.ecosysteem}`
    const hoek = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
    knopen.push({ id: hub, soort: 'hub', naam: c.naam, r: 9, status: c.status, x: Math.cos(hoek) * 190, y: Math.sin(hoek) * 190 })
    lijnen.push({ id: `klant>${hub}`, source: 'klant', target: hub, soort: 'structuur', status: c.status, afstand: 125 })
    for (const l of c.links) {
      const j = hash(l.id)
      knopen.push({
        id: l.id, soort: 'link', naam: l.naam, status: l.status, link: l,
        r: l.status === 'mogelijk' ? 3.5 + (l.score ?? 0) * 4 : 6,
        x: Math.cos(hoek) * 240 + (j % 40) - 20, y: Math.sin(hoek) * 240 + ((j >> 6) % 40) - 20,
      })
      lijnen.push({ id: `${hub}>${l.id}`, source: hub, target: l.id, soort: 'structuur', status: l.status, afstand: l.status === 'mogelijk' ? 50 : 40 })
    }
  })
  for (const v of data.verbanden) {
    if (v.van.startsWith('moment:') && !knopen.some((k) => k.id === v.van)) {
      knopen.push({ id: v.van, soort: 'moment', naam: MOMENT_LABEL[v.van.slice(7) as MomentId] ?? v.van, r: 8 })
      lijnen.push({ id: `klant>${v.van}`, source: 'klant', target: v.van, soort: 'structuur', afstand: 90 })
    }
    lijnen.push({ id: `${v.van}~${v.naar}`, source: v.van, target: v.naar, soort: 'verband', afstand: 160 })
  }
  return { knopen, lijnen }
}

export function EcosysteemBrein({ data, klantNaam, maxHoogte = 640 }: { data: Ecosystemen; klantNaam: string; maxHoogte?: number }) {
  const wrap = useRef<HTMLDivElement>(null)
  const svg = useRef<SVGSVGElement>(null)
  const posities = useRef(new Map<string, Punt>())
  const sim = useRef<Simulation<Knoop, Lijn> | null>(null)
  const [, setTick] = useState(0)
  const [breedte, setBreedte] = useState(800)
  const hoogte = Math.round(Math.min(maxHoogte, Math.max(360, breedte * 0.8))) // the layout is roughly round
  const [zicht, setZicht] = useState({ k: 1, x: 0, y: 0 })
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [gekozen, setGekozen] = useState<string | null>(null)
  const [filter, setFilter] = useState<Record<LinkStatus, boolean>>({ actief: true, gekend: true, mogelijk: true })
  const [redenering, setRedenering] = useState(true)
  const handmatig = useRef(false) // user zoomed or panned: stop auto-fitting
  const maat = useRef({ b: 800, h: hoogte })
  useEffect(() => { maat.current = { b: breedte, h: hoogte } }, [breedte, hoogte])

  /** Zoom and offset that fit every node (plus room for labels) in the frame. */
  const pasIn = () => {
    const ps = [...posities.current.values()]
    if (!ps.length) return { k: 1, x: 0, y: 0 }
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y)
    const [x0, x1, y0, y1] = [Math.min(...xs) - 70, Math.max(...xs) + 70, Math.min(...ys) - 30, Math.max(...ys) + 40]
    const k = Math.min(1.4, Math.max(0.35, Math.min(maat.current.b / (x1 - x0), maat.current.h / (y1 - y0))))
    return { k, x: (-(x0 + x1) / 2) * k, y: (-(y0 + y1) / 2) * k }
  }

  // Only re-layout when the structure changes, not on every poll
  const sleutel = JSON.stringify([data.clusters.map((c) => c.links.map((l) => l.id + l.status + (l.score ?? ''))), data.verbanden.map((v) => v.van + v.naar)])
  const graaf = useMemo(() => bouwGraaf(data, klantNaam), [sleutel, klantNaam]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    for (const k of graaf.knopen) {
      const p = posities.current.get(k.id)
      if (p && k.soort !== 'klant') Object.assign(k, { x: p.x, y: p.y, vx: p.vx, vy: p.vy })
    }
    const s = forceSimulation(graaf.knopen)
      .force('link', forceLink<Knoop, Lijn>(graaf.lijnen).id((k) => k.id).distance((l) => l.afstand).strength((l) => (l.soort === 'verband' ? 0.015 : 0.6)))
      .force('lading', forceManyBody<Knoop>().strength((k) => (k.soort === 'hub' ? -170 : k.soort === 'klant' ? -250 : -38)))
      .force('botsing', forceCollide<Knoop>().radius((k) => (k.soort === 'hub' ? Math.max(k.r + 22, k.naam.length * 3.4) : k.r + 9)))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.06))
      .alpha(posities.current.size ? 0.5 : 1)
      .on('tick', () => {
        for (const k of graaf.knopen) posities.current.set(k.id, { x: k.x!, y: k.y!, vx: k.vx, vy: k.vy })
        if (!handmatig.current) setZicht(pasIn())
        setTick((t) => t + 1)
      })
    sim.current = s
    return () => { s.stop() }
  }, [graaf])

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBreedte(e.contentRect.width))
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
        const k = Math.min(3, Math.max(0.35, z.k * Math.exp(-e.deltaY * 0.0015)))
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
  const sleep = useRef<{ knoop?: Knoop; start: { x: number; y: number }; zicht: typeof zicht; bewogen: boolean } | null>(null)
  const omlaag = (e: React.PointerEvent, knoop?: Knoop) => {
    e.stopPropagation()
    ;(e.target as Element).setPointerCapture(e.pointerId)
    sleep.current = { knoop, start: { x: e.clientX, y: e.clientY }, zicht, bewogen: false }
    if (knoop && knoop.soort !== 'klant') sim.current?.alphaTarget(0.25).restart()
  }
  const beweeg = (e: React.PointerEvent) => {
    const s = sleep.current
    if (!s) return
    if (Math.abs(e.clientX - s.start.x) + Math.abs(e.clientY - s.start.y) > 3) s.bewogen = true
    if (s.knoop && s.knoop.soort !== 'klant') {
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
    if (s.knoop && s.knoop.soort !== 'klant') { s.knoop.fx = null; s.knoop.fy = null; sim.current?.alphaTarget(0) }
    if (!s.bewogen) setGekozen(s.knoop && s.knoop.soort !== 'klant' ? s.knoop.id : null)
  }

  const zichtbaar = (k: Knoop) => !k.status || k.soort === 'hub' || filter[k.status]
  const knoopVan = new Map(graaf.knopen.map((k) => [k.id, k]))
  const lijnen = graaf.lijnen.filter((l) => {
    const a = knoopVan.get(id(l.source!))!, b = knoopVan.get(id(l.target!))!
    return zichtbaar(a) && zichtbaar(b) && (l.soort === 'structuur' || redenering)
  })
  const focus = hover?.id ?? gekozen
  const buren = useMemo(() => {
    if (!focus) return null
    const set = new Set([focus])
    for (const l of graaf.lijnen) {
      const a = id(l.source!), b = id(l.target!)
      if (a === focus) set.add(b)
      if (b === focus) set.add(a)
    }
    return set
  }, [focus, graaf])
  const dim = (ids: string[]) => (buren && !ids.some((i) => i === focus) && !ids.every((i) => buren.has(i)) ? 0.12 : 1)

  const tel = (s: LinkStatus) => data.clusters.reduce((n, c) => n + c.links.filter((l) => l.status === s).length, 0)
  const gekozenKnoop = gekozen ? knoopVan.get(gekozen) : undefined
  const hoverKnoop = hover ? knoopVan.get(hover.id) : undefined

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        {/* Legend + filters in one row above the graph */}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          {STATUSSEN.map((s) => (
            <button key={s} onClick={() => setFilter((f) => ({ ...f, [s]: !f[s] }))} aria-pressed={filter[s]}
              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ring-1 transition ${filter[s] ? 'bg-white text-slate-700 ring-slate-300' : 'bg-slate-100 text-slate-400 ring-transparent line-through'}`}>
              <svg width="30" height="10" aria-hidden>
                <line x1="1" y1="5" x2="20" y2="5" stroke={LINK_KLEUR[s]} strokeWidth="2" strokeDasharray={LINK_STREEP[s]} strokeLinecap="round" />
                <circle cx="25" cy="5" r="4" fill={s === 'mogelijk' ? '#fff' : LINK_KLEUR[s]} stroke={LINK_KLEUR[s]} strokeWidth="2" />
              </svg>
              {LINK_LABEL[s]} <b className="tabular-nums">{tel(s)}</b>
            </button>
          ))}
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={redenering} onChange={(e) => setRedenering(e.target.checked)} className="accent-kbc-600" />
            Redeneerlijnen
          </label>
          <div className="ml-auto flex items-center gap-1">
            {[{ icon: Minus, f: 1 / 1.25, l: 'Uitzoomen' }, { icon: Plus, f: 1.25, l: 'Inzoomen' }].map(({ icon: I, f, l }) => (
              <button key={l} aria-label={l} title={l} onClick={() => { handmatig.current = true; setZicht((z) => ({ k: Math.min(3, Math.max(0.35, z.k * f)), x: z.x * f, y: z.y * f })) }}
                className="grid size-7 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-kbc-400"><I size={14} /></button>
            ))}
            <button aria-label="Passend maken" title="Passend maken" onClick={() => { handmatig.current = false; setZicht(pasIn()) }}
              className="grid size-7 place-items-center rounded-lg bg-white text-slate-600 ring-1 ring-slate-200 hover:ring-kbc-400"><Maximize2 size={13} /></button>
          </div>
        </div>

        <div ref={wrap} className="relative overflow-hidden rounded-xl bg-gradient-to-b from-kbc-50 to-white ring-1 ring-slate-200" style={{ height: hoogte }}>
          <svg ref={svg} width={breedte} height={hoogte} className="cursor-grab touch-none select-none active:cursor-grabbing"
            onPointerDown={(e) => omlaag(e)} onPointerMove={beweeg} onPointerUp={omhoog} onPointerLeave={() => setHover(null)}
            role="img" aria-label={`Ecosysteemkaart van ${klantNaam}: ${data.clusters.length} ecosystemen, ${tel('actief')} actieve, ${tel('gekend')} gekende en ${tel('mogelijk')} mogelijke links`}>
            <g transform={`translate(${breedte / 2 + zicht.x},${hoogte / 2 + zicht.y}) scale(${zicht.k})`}>
              {lijnen.map((l) => {
                const a = l.source as Knoop, b = l.target as Knoop
                if (a.x == null || b.x == null) return null
                const o = dim([a.id, b.id])
                if (l.soort === 'verband') {
                  // Curved so reasoning lines read apart from the cluster spokes
                  const mx = (a.x + b.x) / 2 - (b.y! - a.y!) * 0.15, my = (a.y! + b.y!) / 2 + (b.x - a.x) * 0.15
                  return <path key={l.id} d={`M${a.x},${a.y}Q${mx},${my} ${b.x},${b.y}`} fill="none" stroke={LINK_KLEUR.mogelijk}
                    strokeWidth={1} strokeOpacity={buren ? o * 0.8 : 0.28} />
                }
                return <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={l.status ? LINK_KLEUR[l.status] : NAVY}
                  strokeWidth={a.soort === 'klant' ? 2 : 1.5} strokeDasharray={l.status ? LINK_STREEP[l.status] : '2 3'} strokeLinecap="round"
                  strokeOpacity={o * (a.soort === 'klant' ? 0.55 : 0.85)} />
              })}
              {graaf.knopen.filter(zichtbaar).map((k) => {
                if (k.x == null) return null
                const o = buren ? (buren.has(k.id) ? 1 : 0.15) : 1
                const kleur = k.status ? LINK_KLEUR[k.status] : NAVY
                const label = k.soort !== 'link' || k.status !== 'mogelijk' || zicht.k > 1.35 || (buren?.has(k.id) ?? false)
                const hol = k.status === 'mogelijk' && k.soort === 'link'
                const tekst = (k.soort === 'hub' || k.soort === 'klant' ? 12 : 10) / Math.sqrt(Math.min(1, zicht.k))
                return (
                  <g key={k.id} transform={`translate(${k.x},${k.y})`} opacity={o} className="cursor-pointer"
                    onPointerDown={(e) => omlaag(e, k)}
                    onPointerEnter={(e) => setHover({ id: k.id, ...naarScherm(e) })}
                    onPointerMove={(e) => hover?.id === k.id && setHover({ id: k.id, ...naarScherm(e) })}
                    onPointerLeave={() => setHover(null)}>
                    <circle r={k.r + 8} fill="transparent" />{/* hit target bigger than the mark */}
                    {k.soort === 'hub' && <circle r={k.r + 5} fill="none" stroke={kleur} strokeWidth={2} strokeDasharray={k.status ? LINK_STREEP[k.status] : undefined} />}
                    {gekozen === k.id && <circle r={k.r + (k.soort === 'hub' ? 10 : 5)} fill="none" stroke={NAVY} strokeWidth={1.5} />}
                    <circle r={k.r} fill={k.soort === 'hub' || k.soort === 'klant' || k.soort === 'moment' ? NAVY : hol ? '#fff' : kleur}
                      stroke={k.soort === 'moment' ? LINK_KLEUR.mogelijk : hol ? kleur : '#fff'} strokeWidth={2} />
                    {label && (
                      <text y={k.r + (k.soort === 'hub' ? 8 : 3) + tekst} textAnchor="middle" paintOrder="stroke" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round"
                        fontSize={tekst} className={k.soort === 'hub' || k.soort === 'klant' ? 'fill-kbc-800 font-semibold' : 'fill-slate-600'}>
                        {kort(k.naam, k.soort === 'link' ? 30 : 40)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {hoverKnoop && hover && <Tooltip knoop={hoverKnoop} x={hover.x} y={hover.y} breedte={breedte} />}
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">Scroll om te zoomen · sleep om te verschuiven · klik een knoop voor details</p>
        </div>
      </div>

      <Detail knoop={gekozenKnoop} data={data} knoopVan={knoopVan} kies={setGekozen} />
    </div>
  )

  function naarScherm(e: React.PointerEvent) {
    const rect = wrap.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }
}

const kort = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

function StatusPil({ status }: { status: LinkStatus }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
      <span className="size-2 rounded-full" style={{ background: status === 'mogelijk' ? '#fff' : LINK_KLEUR[status], boxShadow: `inset 0 0 0 2px ${LINK_KLEUR[status]}` }} />
      {LINK_LABEL[status]}
    </span>
  )
}

function Tooltip({ knoop, x, y, breedte }: { knoop: Knoop; x: number; y: number; breedte: number }) {
  const l = knoop.link
  return (
    <div className="pointer-events-none absolute z-10 max-w-64 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200"
      style={{ left: Math.min(x + 14, breedte - 260), top: y + 14 }}>
      <p className="font-semibold text-kbc-800">{knoop.naam}</p>
      {knoop.soort === 'hub' && <p className="text-slate-500">Ecosysteem</p>}
      {knoop.soort === 'moment' && <p className="text-slate-500">Bevestigd levensmoment</p>}
      {l && (
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-slate-600">
          <StatusPil status={l.status} />
          {l.score != null && <span className="tabular-nums">{pct(l.score)} kans</span>}
          {l.herkomst && <span>{HERKOMST_LABEL[l.herkomst]}</span>}
        </div>
      )}
    </div>
  )
}

function Detail({ knoop, data, knoopVan, kies }: { knoop?: Knoop; data: Ecosystemen; knoopVan: Map<string, Knoop>; kies: (id: string | null) => void }) {
  if (!knoop) {
    const s = data.samenvatting
    return (
      <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-kbc-800">{s.ecosystemen} ecosystemen</p>
        <ul className="space-y-1.5">
          {STATUSSEN.map((st) => <li key={st} className="flex items-center justify-between"><StatusPil status={st} /><b className="tabular-nums text-kbc-800">{s[st]}</b></li>)}
        </ul>
        {s.nieuweEcosystemen.length > 0 && (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Nieuw voor deze klant</p>
            <div className="flex flex-wrap gap-1">
              {s.nieuweEcosystemen.map((e) => (
                <button key={e} onClick={() => kies(`eco:${e}`)} className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200 hover:ring-kbc-400">
                  {data.clusters.find((c) => c.ecosysteem === e)?.naam ?? e}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500">Klik een knoop voor de herkomst of de redenering achter een mogelijke link.</p>
      </aside>
    )
  }

  if (knoop.soort === 'hub') {
    const c = data.clusters.find((x) => `eco:${x.ecosysteem}` === knoop.id)!
    return (
      <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div><p className="text-xs text-slate-500">Ecosysteem</p><p className="font-semibold text-kbc-800">{c.naam}</p></div>
          <StatusPil status={c.status} />
        </div>
        <ul className="space-y-1">
          {c.links.map((l) => (
            <li key={l.id}>
              <button onClick={() => kies(l.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-white">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: l.status === 'mogelijk' ? '#fff' : LINK_KLEUR[l.status], boxShadow: `inset 0 0 0 2px ${LINK_KLEUR[l.status]}` }} />
                  <span className="truncate text-slate-700">{l.naam}</span>
                </span>
                {l.score != null && <span className="text-xs tabular-nums text-slate-500">{pct(l.score)}</span>}
              </button>
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  if (knoop.soort === 'moment') {
    const naar = data.verbanden.filter((v) => v.van === knoop.id).map((v) => knoopVan.get(v.naar)).filter(Boolean) as Knoop[]
    return (
      <aside className="space-y-2 rounded-xl bg-slate-50 p-4 text-sm">
        <p className="text-xs text-slate-500">Bevestigd levensmoment</p>
        <p className="font-semibold text-kbc-800">{knoop.naam}</p>
        <p className="text-xs text-slate-500">Opent {naar.length} mogelijke links:</p>
        <ul className="space-y-1">{naar.map((k) => <li key={k.id}><button onClick={() => kies(k.id)} className="text-left text-kbc-600 hover:underline">{k.naam}</button></li>)}</ul>
      </aside>
    )
  }

  const l = knoop.link!
  const leidtTot = data.verbanden.filter((v) => v.van === l.id).map((v) => knoopVan.get(v.naar)).filter(Boolean) as Knoop[]
  return (
    <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
      <div>
        <p className="text-xs text-slate-500">{l.soort === 'partner' ? 'Partner' : 'Product'} · {data.clusters.find((c) => c.ecosysteem === l.ecosysteem)?.naam}</p>
        <p className="font-semibold text-kbc-800">{l.naam}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <StatusPil status={l.status} />
        {l.herkomst && <span className="text-xs text-slate-600">{HERKOMST_LABEL[l.herkomst]}</span>}
        {l.sinds && <span className="text-xs text-slate-500">sinds {new Date(l.sinds).toLocaleDateString('nl-BE')}</span>}
      </div>
      {l.status === 'gekend' && <p className="text-xs text-slate-500">De klant deelt geen data van deze partner. KBC weet enkel dat de relatie bestaat.</p>}
      {l.score != null && (
        <div>
          <div className="mb-1 flex justify-between text-xs"><span className="text-slate-500">Kans op interesse</span><b className="tabular-nums text-kbc-800">{pct(l.score)}</b></div>
          <div className="h-2 rounded-full bg-slate-200"><div className="h-full rounded-full" style={{ width: pct(l.score), background: LINK_KLEUR.mogelijk }} /></div>
        </div>
      )}
      {l.waarom && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Waarom</p>
          <ul className="space-y-1.5">
            {l.waarom.map((w) => (
              <li key={w.via} className="rounded-lg bg-white p-2 text-xs ring-1 ring-slate-200">
                <button onClick={() => kies(w.via)} className="font-medium text-kbc-600 hover:underline">{w.naam}</button>
                <p className="text-slate-600">{w.reden}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {leidtTot.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Leidt tot</p>
          <ul className="flex flex-wrap gap-1">
            {leidtTot.map((k) => <li key={k.id}><button onClick={() => kies(k.id)} className="rounded-full bg-white px-2 py-0.5 text-xs ring-1 ring-slate-200 hover:ring-kbc-400">{k.naam}</button></li>)}
          </ul>
        </div>
      )}
    </aside>
  )
}

/** Table view of the same clusters, so nothing depends on reading the graph. */
export function ClusterTabel({ data }: { data: Ecosystemen }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr><th className="pb-2 font-medium">Ecosysteem</th><th className="font-medium">Link</th><th className="font-medium">Status</th><th className="font-medium">Herkomst / waarom</th><th className="text-right font-medium">Kans</th></tr>
        </thead>
        <tbody>
          {data.clusters.flatMap((c) => c.links.map((l, i) => (
            <tr key={l.id} className={i === 0 ? 'border-t border-slate-200' : ''}>
              <td className="py-1.5 pr-3 align-top font-medium text-kbc-800">{i === 0 ? c.naam : ''}</td>
              <td className="pr-3 align-top text-slate-700">{l.naam}{l.soort === 'partner' && <span className="ml-1 text-xs text-slate-400">partner</span>}</td>
              <td className="pr-3 align-top"><StatusPil status={l.status} /></td>
              <td className="pr-3 align-top text-xs text-slate-500">{l.herkomst ? HERKOMST_LABEL[l.herkomst] : l.waarom?.map((w) => w.naam).join(', ')}</td>
              <td className="text-right align-top tabular-nums text-slate-600">{l.score != null ? pct(l.score) : ''}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  )
}
