import { useCallback, useMemo, useState } from 'react'
import { forceCollide, forceLink, forceManyBody, forceX, forceY, type SimulationLinkDatum } from 'd3-force'
import { ArrowRight } from 'lucide-react'
import type { Ecosystemen, KlantKort, Link, LinkStatus } from '../types'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { HERKOMST_LABEL, LINK_KLEUR, LINK_STREEP, pct } from '../lib/labels'
import { hash, knoopId as id, kort, labelBij, NAVY, plaatsBloemen, ringStraal, STATUSSEN, useGraafCanvas, type BloemKnoop } from '../lib/useGraafCanvas'
import { StatusFilter, StatusPil, VolScherm, VolSchermKnop, ZoomKnoppen } from './graaf'
import { Kaart, LiveBadge } from './ui'

// Every customer in one graph, connected through the ecosystems (or the products and partners) they have in
// common. Clusters and statuses come as-is from GET /klanten/:id/ecosystemen; nothing is re-scored here.

interface Rij { klant: KlantKort; eco: Ecosystemen }
type Niveau = 'ecosysteem' | 'link'
/** One customer's relation to a hub or link node. */
interface Relatie { klantId: string; klantNaam: string; status: LinkStatus; links: Link[] }
interface Knoop extends BloemKnoop {
  soort: 'klant' | 'hub' | 'link'
  naam: string
  /** Customers are softly held on a ring, so what they share settles between them and the rest outside. */
  anker?: { x: number; y: number }
  ecosysteem?: string
  link?: Link
  /** Hubs on link level: its products and partners, on a ring around it. */
  bloem?: Knoop[]
  relaties: Relatie[]
}
/** 'skelet' is invisible: on link level it keeps every hub where it sits on ecosystem level. */
// Only customers and hubs are simulated. Products and partners sit on a fixed ring around their hub ("flower"),
// which keeps each ecosystem readable however many links it has.
interface Lijn extends SimulationLinkDatum<Knoop> { id: string; soort: 'klant' | 'spaak' | 'skelet'; status?: LinkStatus; afstand: number }

const RANG: Record<LinkStatus, number> = { actief: 0, gekend: 1, mogelijk: 2 }
const sterkste = (links: Link[]) => links.reduce((s, l) => (RANG[l.status] < RANG[s] ? l.status : s), 'mogelijk' as LinkStatus)
const gedeeld = (k: Knoop) => k.soort !== 'klant' && k.relaties.length > 1

function bouwNetwerk(rijen: Rij[], o: { niveau: Niveau; filter: Record<LinkStatus, boolean>; alleenGedeeld: boolean }) {
  const knopen = new Map<string, Knoop>()
  const lijnen: Lijn[] = []
  const rond = (s: string, straal: number) => { const h = hash(s), a = ((h >>> 0) % 360) * (Math.PI / 180); return { x: Math.cos(a) * straal, y: Math.sin(a) * straal } }
  const knoop = (k: Omit<Knoop, 'relaties' | 'x' | 'y'>, straal: number) => {
    if (!knopen.has(k.id)) knopen.set(k.id, { ...k, relaties: [], ...rond(k.id, straal) })
    return knopen.get(k.id)!
  }

  const ring = rijen.length > 1 ? Math.max(260, rijen.length * 60) : 0
  rijen.forEach(({ klant }, i) => {
    const a = (i / rijen.length) * Math.PI * 2 + Math.PI
    const anker = { x: Math.cos(a) * ring, y: Math.sin(a) * ring * 0.75 }
    knopen.set(`klant:${klant.id}`, { id: `klant:${klant.id}`, soort: 'klant', naam: klant.naam, r: 13, relaties: [], anker, ...anker })
  })
  for (const { klant, eco } of rijen) {
    for (const c of eco.clusters) {
      const links = c.links.filter((l) => o.filter[l.status])
      if (!links.length) continue
      const hub = knoop({ id: `eco:${c.ecosysteem}`, soort: 'hub', naam: c.naam, r: 8, ecosysteem: c.ecosysteem }, 320)
      hub.relaties.push({ klantId: klant.id, klantNaam: klant.naam, status: sterkste(links), links })
      if (o.niveau === 'link') {
        for (const l of links) {
          const n = knoop({ id: l.id, soort: 'link', naam: l.naam, r: 4, ecosysteem: c.ecosysteem, link: l }, 0)
          n.relaties.push({ klantId: klant.id, klantNaam: klant.naam, status: l.status, links: [l] })
        }
      }
    }
  }

  // "Only shared" keeps what two or more customers have in common; on link level a hub stays while it has links
  const blijft = (k: Knoop): boolean => k.soort === 'klant'
    || (k.soort === 'hub' && o.niveau === 'link' ? [...knopen.values()].some((l) => l.soort === 'link' && l.ecosysteem === k.ecosysteem && blijft(l)) : !o.alleenGedeeld || gedeeld(k))
  const zichtbaar = [...knopen.values()].filter(blijft)
  for (const k of zichtbaar) {
    if (k.soort === 'hub') k.r = 7 + Math.min(k.relaties.length, 6) * 2
    if (k.soort === 'link') k.r = 4 + Math.min(k.relaties.length, 6) * 1.5
    const zichtbaarNaarKlant = o.niveau === 'ecosysteem' ? k.soort === 'hub' : k.soort === 'link'
    for (const r of zichtbaarNaarKlant || k.soort === 'hub' ? k.relaties : []) {
      lijnen.push({ id: `klant:${r.klantId}>${k.id}`, source: `klant:${r.klantId}`, target: k.id, soort: zichtbaarNaarKlant ? 'klant' : 'skelet', status: r.status, afstand: 150 })
    }
    if (k.soort === 'link') {
      lijnen.push({ id: `eco:${k.ecosysteem}>${k.id}`, source: `eco:${k.ecosysteem}`, target: k.id, soort: 'spaak', afstand: 0 })
      const hub = knopen.get(`eco:${k.ecosysteem}`)!
      ;(hub.bloem ??= []).push(k)
    }
  }
  for (const h of zichtbaar) {
    if (!h.bloem) continue
    h.bloem.sort((a, b) => RANG[sterkste(a.relaties.flatMap((r) => r.links))] - RANG[sterkste(b.relaties.flatMap((r) => r.links))] || a.naam.localeCompare(b.naam))
    h.bloemStraal = ringStraal(h.bloem)
  }
  return {
    knopen: zichtbaar,
    lijnen,
    skelet: { knopen: zichtbaar.filter((k) => k.soort !== 'link'), lijnen: lijnen.filter((l) => l.soort !== 'spaak' && knopen.get(id(l.target!))!.soort === 'hub') },
  }
}

/** Live network of every customer. Polls their ecosystem clusters like the Ecosystemen page does. */
export function KlantenNetwerk({ klanten, openKlant }: { klanten: KlantKort[]; openKlant: (id: string) => void }) {
  const [weergave, setWeergave] = useState<'graaf' | 'lijst'>('graaf')
  const [vol, setVol] = useState(false)
  const sluit = useCallback(() => setVol(false), [])
  const { data: rijen } = usePoll(
    async () => Promise.all(klanten.map(async (klant) => ({ klant, eco: await api<Ecosystemen>(`/klanten/${klant.id}/ecosystemen`) }))),
    5000, [klanten.map((k) => k.id).join()],
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-kbc-800">Klantennetwerk</h1>
          <p className="text-sm text-slate-500">Hoe klanten via ecosystemen, producten en partners met elkaar verbonden zijn</p>
        </div>
        <LiveBadge />
      </div>

      <Kaart titel={`${klanten.length} klanten`}
        extra={
          <div className="flex items-center gap-2">
            {weergave === 'graaf' && rijen && <VolSchermKnop open={() => setVol(true)} />}
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs">
              {(['graaf', 'lijst'] as const).map((w) => (
                <button key={w} onClick={() => setWeergave(w)} aria-pressed={weergave === w}
                  className={`rounded-md px-2.5 py-1 ${weergave === w ? 'bg-white font-medium text-kbc-800 shadow-sm' : 'text-slate-500'}`}>
                  {w === 'graaf' ? 'Graaf' : 'Lijst'}
                </button>
              ))}
            </div>
          </div>
        }>
        {!rijen ? <p className="text-sm text-slate-500">Laden…</p>
          : weergave === 'lijst' ? <NetwerkTabel rijen={rijen} openKlant={openKlant} />
          : vol ? <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Geopend op volledig scherm.</p>
          : <NetwerkGraaf rijen={rijen} openKlant={openKlant} />}
      </Kaart>

      {vol && rijen && (
        <VolScherm titel="Klantennetwerk" sub={`${klanten.length} klanten`} sluit={sluit}>
          <NetwerkGraaf rijen={rijen} openKlant={openKlant} vul />
        </VolScherm>
      )}
    </div>
  )
}

function NetwerkGraaf({ rijen, openKlant, vul = false }: { rijen: Rij[]; openKlant: (id: string) => void; vul?: boolean }) {
  const [niveau, setNiveau] = useState<Niveau>('ecosysteem')
  const [filter, setFilter] = useState<Record<LinkStatus, boolean>>({ actief: true, gekend: true, mogelijk: true })
  const [alleenGedeeld, setAlleenGedeeld] = useState(false)
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [gekozen, setGekozen] = useState<string | null>(null)

  // Only re-layout when the structure or the view options change, not on every poll
  const sleutel = JSON.stringify([rijen.map((r) => [r.klant.id, r.klant.naam, r.eco.clusters.map((c) => c.links.map((l) => l.id + l.status))]), niveau, filter, alleenGedeeld])
  const graaf = useMemo(() => bouwNetwerk(rijen, { niveau, filter, alleenGedeeld }), [sleutel]) // eslint-disable-line react-hooks/exhaustive-deps
  const canvas = useGraafCanvas<Knoop, Lijn>({
    graaf: graaf.skelet, vul, maxHoogte: 720,
    krachten: (s, lijnen) => s
      .force('link', forceLink<Knoop, Lijn>(lijnen).id((k) => k.id).distance((l) => l.afstand).strength(0.5))
      .force('lading', forceManyBody<Knoop>().strength((k) => (k.soort === 'klant' ? -500 : -220 - (k.bloem?.length ?? 0) * 25)))
      .force('botsing', forceCollide<Knoop>().radius((k) => (k.soort === 'klant' ? k.r + 40 : Math.max(k.r + 22, k.naam.length * 3.4, (k.bloemStraal ?? 0) + 36))).iterations(3))
      .force('x', forceX<Knoop>((k) => k.anker?.x ?? 0).strength((k) => (k.anker ? 0.9 : 0.05)))
      .force('y', forceY<Knoop>((k) => k.anker?.y ?? 0).strength((k) => (k.anker ? 0.9 : 0.07))),
    omvang: (k) => (k.bloemStraal ? k.bloemStraal + 14 : 0),
    sleepbaar: (k) => k.soort !== 'link',
    kies: (k) => setGekozen(k?.id ?? null),
  })
  const { wrap, svg, wrapStijl, breedte, hoogte, zicht } = canvas
  plaatsBloemen(graaf.skelet.knopen)

  const knoopVan = new Map(graaf.knopen.map((k) => [k.id, k]))
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
  const dim = (a: string, b: string) => (buren && a !== focus && b !== focus ? 0.1 : 1)
  // Counts on the filter chips: every customer relation on this level, regardless of the filter
  const tel = (s: LinkStatus) => rijen.reduce((n, r) => n + (niveau === 'link' ? r.eco.samenvatting[s] : r.eco.clusters.filter((c) => c.status === s).length), 0)
  const klanten = graaf.knopen.filter((k) => k.soort === 'klant').length
  const hubs = graaf.knopen.filter((k) => k.soort === 'hub')
  const gekozenKnoop = gekozen ? knoopVan.get(gekozen) : undefined
  const hoverKnoop = hover ? knoopVan.get(hover.id) : undefined

  return (
    <div className={`grid gap-4 xl:grid-cols-[1fr_300px] ${vul ? 'h-full min-h-0' : ''}`}>
      <div className={`min-w-0 ${vul ? 'flex min-h-[420px] flex-col' : ''}`}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs" role="group" aria-label="Niveau">
            {([['ecosysteem', 'Ecosystemen'], ['link', 'Producten en partners']] as const).map(([n, label]) => (
              <button key={n} onClick={() => { setNiveau(n); setGekozen(null) }} aria-pressed={niveau === n}
                className={`rounded-md px-2.5 py-1 ${niveau === n ? 'bg-white font-medium text-kbc-800 shadow-sm' : 'text-slate-500'}`}>{label}</button>
            ))}
          </div>
          <StatusFilter filter={filter} zet={setFilter} tel={tel} />
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={alleenGedeeld} onChange={(e) => setAlleenGedeeld(e.target.checked)} className="accent-kbc-600" />
            Alleen gedeeld
          </label>
          <ZoomKnoppen zoom={canvas.zoom} pas={canvas.pas} />
        </div>

        <div ref={wrap} className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-kbc-50 to-white ring-1 ring-slate-200 ${vul ? 'min-h-0 flex-1' : ''}`} style={wrapStijl}>
          <svg ref={svg} width={breedte} height={hoogte} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
            {...canvas.svgProps} onPointerLeave={() => setHover(null)}
            role="img" aria-label={`Klantennetwerk: ${klanten} klanten verbonden via ${hubs.length} ecosystemen, waarvan ${hubs.filter(gedeeld).length} gedeeld`}>
            <g transform={canvas.transform}>
              {graaf.lijnen.map((l) => {
                const a = knoopVan.get(id(l.source!))!, b = knoopVan.get(id(l.target!))!
                if (a.x == null || b.x == null) return null
                const o = dim(a.id, b.id)
                if (l.soort === 'skelet') return null
                if (l.soort === 'spaak') return <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#94a3b8" strokeWidth={1} strokeOpacity={o * 0.5} />
                return <line key={l.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={LINK_KLEUR[l.status!]} strokeWidth={niveau === 'link' ? 1.25 : 2}
                  strokeDasharray={LINK_STREEP[l.status!]} strokeLinecap="round" strokeOpacity={niveau === 'link' ? (buren ? o * 0.8 : 0.18) : o * 0.8} />
              })}
              {graaf.knopen.map((k) => {
                if (k.x == null) return null
                const o = buren ? (buren.has(k.id) ? 1 : 0.15) : 1
                const status = k.soort === 'link' ? sterkste(k.relaties.flatMap((r) => r.links)) : undefined
                const label = k.soort !== 'link' || gedeeld(k) || zicht.k > 1.35 || (buren?.has(k.id) ?? false)
                const tekst = (k.soort === 'link' ? 10 : 12) / Math.sqrt(Math.min(1, zicht.k))
                const pos = k.bloemStraal ? { x: 0, y: -(k.bloemStraal + 2), anker: 'middle' as const } : labelBij(k, tekst, k.soort === 'link' ? 3 : 6)
                return (
                  <g key={k.id} transform={`translate(${k.x},${k.y})`} opacity={o} className="cursor-pointer"
                    onPointerDown={(e) => canvas.knoopOmlaag(e, k)}
                    onPointerEnter={(e) => setHover({ id: k.id, ...canvas.naarScherm(e) })}
                    onPointerMove={(e) => hover?.id === k.id && setHover({ id: k.id, ...canvas.naarScherm(e) })}
                    onPointerLeave={() => setHover(null)}>
                    <circle r={k.r + (k.soort === 'link' ? 4 : 8)} fill="transparent" />{/* hit target bigger than the mark */}
                    {gedeeld(k) && <circle r={k.r + 4} fill="none" stroke={NAVY} strokeWidth={1.25} strokeOpacity={0.55} />}
                    {gekozen === k.id && <circle r={k.r + (k.soort === 'klant' ? 9 : 7)} fill="none" stroke={NAVY} strokeWidth={1.5} />}
                    {k.soort === 'klant' && <rect x={-k.r} y={-k.r} width={k.r * 2} height={k.r * 2} rx={5} fill={NAVY} stroke="#fff" strokeWidth={2} />}
                    {k.soort === 'hub' && <circle r={k.r} fill="#fff" stroke={NAVY} strokeWidth={2.5} />}
                    {k.soort === 'link' && <circle r={k.r} fill={status === 'mogelijk' ? '#fff' : LINK_KLEUR[status!]} stroke={status === 'mogelijk' ? LINK_KLEUR.mogelijk : '#fff'} strokeWidth={2} />}
                    {label && (
                      <text x={pos.x} y={pos.y} textAnchor={pos.anker} paintOrder="stroke" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round"
                        fontSize={tekst} className={k.soort === 'klant' ? 'fill-kbc-800 font-bold' : k.soort === 'hub' ? 'fill-kbc-800 font-semibold' : 'fill-slate-600'}>
                        {kort(k.naam, k.soort === 'link' ? 30 : 40)}
                      </text>
                    )}
                  </g>
                )
              })}
            </g>
          </svg>

          {hoverKnoop && hover && <Tooltip knoop={hoverKnoop} x={hover.x} y={hover.y} breedte={breedte} />}
          {graaf.knopen.length === klanten && <p className="absolute inset-x-0 top-1/3 text-center text-sm text-slate-500">Geen verbindingen met deze filters.</p>}
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">
            ■ klant · ○ ecosysteem · dubbele rand = gedeeld door meerdere klanten · klik een knoop voor details
          </p>
        </div>
      </div>

      <div className={vul ? 'min-h-0 overflow-y-auto' : ''}>
        <Detail knoop={gekozenKnoop} graaf={graaf} rijen={rijen} niveau={niveau} kies={setGekozen} openKlant={openKlant} />
      </div>
    </div>
  )
}

const soortLabel = (k: Knoop) => (k.soort === 'klant' ? 'Klant' : k.soort === 'hub' ? 'Ecosysteem' : k.link!.soort === 'partner' ? 'Partner' : 'Product')

function Tooltip({ knoop, x, y, breedte }: { knoop: Knoop; x: number; y: number; breedte: number }) {
  return (
    <div className="pointer-events-none absolute z-10 max-w-64 rounded-lg bg-white px-3 py-2 text-xs shadow-lg ring-1 ring-slate-200"
      style={{ left: Math.min(x + 14, breedte - 260), top: y + 14 }}>
      <p className="font-semibold text-kbc-800">{knoop.naam}</p>
      <p className="text-slate-500">
        {soortLabel(knoop)}{knoop.soort !== 'klant' && ` · ${knoop.relaties.length} ${knoop.relaties.length === 1 ? 'klant' : 'klanten'}`}
      </p>
    </div>
  )
}

function Detail({ knoop, graaf, rijen, niveau, kies, openKlant }: {
  knoop?: Knoop; graaf: { knopen: Knoop[] }; rijen: Rij[]; niveau: Niveau; kies: (id: string | null) => void; openKlant: (id: string) => void
}) {
  const knopKlant = (r: { klantId: string; klantNaam: string }) => (
    <button onClick={() => kies(`klant:${r.klantId}`)} className="truncate text-left font-medium text-kbc-600 hover:underline">{r.klantNaam}</button>
  )

  if (!knoop) {
    const top = graaf.knopen.filter((k) => k.soort === (niveau === 'link' ? 'link' : 'hub') && gedeeld(k))
      .sort((a, b) => b.relaties.length - a.relaties.length || a.naam.localeCompare(b.naam)).slice(0, 8)
    return (
      <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-kbc-800">{rijen.length} klanten · {graaf.knopen.filter((k) => k.soort === 'hub').length} ecosystemen</p>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{niveau === 'link' ? 'Meest gedeelde producten en partners' : 'Gedeelde ecosystemen'}</p>
          {top.length === 0 && <p className="text-xs text-slate-400">Niets gedeeld door meerdere klanten.</p>}
          <ul className="space-y-1">
            {top.map((k) => (
              <li key={k.id}>
                <button onClick={() => kies(k.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-white">
                  <span className="truncate text-slate-700">{k.naam}</span>
                  <span className="shrink-0 text-xs tabular-nums text-slate-500">{k.relaties.length} klanten</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-slate-500">Klik een klant, ecosysteem of link om te zien wie ermee verbonden is.</p>
      </aside>
    )
  }

  if (knoop.soort === 'klant') {
    const rij = rijen.find((r) => `klant:${r.klant.id}` === knoop.id)!
    const s = rij.eco.samenvatting
    return (
      <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div>
          <p className="text-xs text-slate-500">Klant · {rij.klant.id}</p>
          <p className="font-semibold text-kbc-800">{rij.klant.naam}</p>
        </div>
        <ul className="space-y-1.5">
          {STATUSSEN.map((st) => <li key={st} className="flex items-center justify-between"><StatusPil status={st} /><b className="tabular-nums text-kbc-800">{s[st]}</b></li>)}
        </ul>
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">{s.ecosystemen} ecosystemen</p>
          <ul className="space-y-1">
            {rij.eco.clusters.map((c) => (
              <li key={c.ecosysteem}>
                <button onClick={() => kies(`eco:${c.ecosysteem}`)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left hover:bg-white">
                  <span className="truncate text-slate-700">{c.naam}</span><StatusPil status={c.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
        <button onClick={() => openKlant(rij.klant.id)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-kbc-800 px-3 py-2 text-sm font-medium text-white hover:bg-kbc-900">
          Open klantfiche <ArrowRight size={14} />
        </button>
      </aside>
    )
  }

  if (knoop.soort === 'hub') {
    return (
      <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
        <div><p className="text-xs text-slate-500">Ecosysteem</p><p className="font-semibold text-kbc-800">{knoop.naam}</p></div>
        <p className="text-xs font-medium text-slate-500">{knoop.relaties.length} {knoop.relaties.length === 1 ? 'klant' : 'klanten'}</p>
        <ul className="space-y-2">
          {knoop.relaties.map((r) => (
            <li key={r.klantId} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">{knopKlant(r)}<StatusPil status={r.status} /></div>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                {r.links.map((l) => (
                  <li key={l.id}>
                    <button onClick={() => kies(l.id)} disabled={niveau !== 'link'} className="flex w-full items-center justify-between gap-2 text-left enabled:hover:text-kbc-600">
                      <span className="truncate">{l.naam}</span>
                      <span className="shrink-0 tabular-nums text-slate-400">{l.score != null ? pct(l.score) : l.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </aside>
    )
  }

  const l = knoop.link!
  return (
    <aside className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm">
      <div>
        <p className="text-xs text-slate-500">{soortLabel(knoop)} · <button onClick={() => kies(`eco:${l.ecosysteem}`)} className="hover:underline">{graaf.knopen.find((k) => k.id === `eco:${l.ecosysteem}`)?.naam}</button></p>
        <p className="font-semibold text-kbc-800">{l.naam}</p>
      </div>
      <p className="text-xs font-medium text-slate-500">{knoop.relaties.length} {knoop.relaties.length === 1 ? 'klant' : 'klanten'}</p>
      <ul className="space-y-2">
        {knoop.relaties.map((r) => {
          const eigen = r.links[0]!
          return (
            <li key={r.klantId} className="rounded-lg bg-white p-2 ring-1 ring-slate-200">
              <div className="flex items-center justify-between gap-2">{knopKlant(r)}<StatusPil status={r.status} /></div>
              <p className="mt-1 text-xs text-slate-500">
                {eigen.herkomst ? HERKOMST_LABEL[eigen.herkomst] : eigen.score != null ? `${pct(eigen.score)} kans · via ${eigen.waarom?.map((w) => w.naam).join(', ')}` : ''}
              </p>
            </li>
          )
        })}
      </ul>
    </aside>
  )
}

/** Table view: ecosystems × customers, so nothing depends on reading the graph. */
function NetwerkTabel({ rijen, openKlant }: { rijen: Rij[]; openKlant: (id: string) => void }) {
  const ecosystemen = new Map<string, string>()
  for (const r of rijen) for (const c of r.eco.clusters) ecosystemen.set(c.ecosysteem, c.naam)
  const aantal = (e: string) => rijen.filter((r) => r.eco.clusters.some((c) => c.ecosysteem === e)).length
  const volgorde = [...ecosystemen.keys()].sort((a, b) => aantal(b) - aantal(a) || ecosystemen.get(a)!.localeCompare(ecosystemen.get(b)!))
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: 200 + rijen.length * 150 }}>
        <thead className="text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="pb-2 font-medium">Ecosysteem</th>
            {rijen.map((r) => <th key={r.klant.id} className="pb-2 font-medium"><button onClick={() => openKlant(r.klant.id)} className="uppercase hover:text-kbc-600">{r.klant.naam}</button></th>)}
          </tr>
        </thead>
        <tbody>
          {volgorde.map((e) => (
            <tr key={e} className="border-t border-slate-200">
              <td className="py-1.5 pr-3 font-medium text-kbc-800">{ecosystemen.get(e)}{aantal(e) > 1 && <span className="ml-1.5 text-xs font-normal text-slate-400">gedeeld</span>}</td>
              {rijen.map((r) => {
                const c = r.eco.clusters.find((x) => x.ecosysteem === e)
                return <td key={r.klant.id} className="pr-3">{c ? <span className="inline-flex items-center gap-1.5"><StatusPil status={c.status} /><span className="text-xs tabular-nums text-slate-500">{c.links.length}</span></span> : <span className="text-slate-300">–</span>}</td>
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
