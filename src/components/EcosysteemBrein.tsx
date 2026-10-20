import { useCallback, useMemo, useState } from 'react'
import { Smartphone } from 'lucide-react'
import { forceCollide, forceLink, forceManyBody, forceX, forceY, type SimulationLinkDatum } from 'd3-force'
import type { Ecosystemen, Kans, Koppeling, KoppelingStatus, Link, LinkStatus, MomentId } from '../types'
import { HERKOMST_LABEL, KANS_STATUS_LABEL, LINK_KLEUR, LINK_STREEP, MOMENT_LABEL, pct } from '../lib/labels'
import { tell, useBridge } from '../lib/pocBridge'
import { knoopId as id, kort, labelBij, NAVY, plaatsBloemen, ringStraal, STATUSSEN, useGraafCanvas, type BloemKnoop } from '../lib/useGraafCanvas'
import { StatusFilter, StatusPil, StatusStip, ZoomKnoppen } from './graaf'
import { KansDialoog, KansStatusRegel } from './KansDialoog'

// "Obsidian brain" of one customer: the customer in the middle, one hub per ecosystem cluster, and every
// active, known and possible link on a ring around its hub ("flower"). Thin amber lines are the reasoning
// behind a possible link. Only the customer, hubs and life moments are simulated; the rings follow their hub.

type Soort = 'klant' | 'hub' | 'link' | 'moment'
interface Knoop extends BloemKnoop {
  soort: Soort
  naam: string
  status?: LinkStatus
  link?: Link
  bloem?: Knoop[]
}
interface Lijn extends SimulationLinkDatum<Knoop> {
  id: string
  /** structuur: customer to hub or moment (simulated) · spaak: hub to link · verband: reasoning · koppeling: partner pair */
  soort: 'structuur' | 'spaak' | 'verband' | 'koppeling'
  koppeling?: KoppelingStatus
  status?: LinkStatus
  afstand: number
}

function bouwGraaf(data: Ecosystemen, klantNaam: string) {
  const knopen: Knoop[] = [{ id: 'klant', soort: 'klant', naam: klantNaam, r: 15, fx: 0, fy: 0 }]
  const lijnen: Lijn[] = []
  const n = data.clusters.length
  data.clusters.forEach((c, i) => {
    const hub = `eco:${c.ecosysteem}`
    const hoek = (i / Math.max(n, 1)) * Math.PI * 2 - Math.PI / 2
    const bloem: Knoop[] = c.links.map((l) => ({ id: l.id, soort: 'link', naam: l.naam, status: l.status, link: l, r: l.status === 'mogelijk' ? 3.5 + (l.score ?? 0) * 4 : 6 }))
    const bloemStraal = ringStraal(bloem)
    knopen.push({ id: hub, soort: 'hub', naam: c.naam, r: 9, status: c.status, bloem, bloemStraal, x: Math.cos(hoek) * (200 + bloemStraal), y: Math.sin(hoek) * (200 + bloemStraal) }, ...bloem)
    lijnen.push({ id: `klant>${hub}`, source: 'klant', target: hub, soort: 'structuur', status: c.status, afstand: 110 + bloemStraal })
    for (const l of c.links) lijnen.push({ id: `${hub}>${l.id}`, source: hub, target: l.id, soort: 'spaak', status: l.status, afstand: 0 })
  })
  for (const v of data.verbanden) {
    if (v.van.startsWith('moment:') && !knopen.some((k) => k.id === v.van)) {
      knopen.push({ id: v.van, soort: 'moment', naam: MOMENT_LABEL[v.van.slice(7) as MomentId] ?? v.van, r: 8 })
      lijnen.push({ id: `klant>${v.van}`, source: 'klant', target: v.van, soort: 'structuur', afstand: 90 })
    }
    lijnen.push({ id: `${v.van}~${v.naar}`, source: v.van, target: v.naar, soort: 'verband', afstand: 0 })
  }
  // Partner pairs: drawn between the two partners, across their ecosystems
  for (const k of data.koppelingen ?? []) {
    if (k.status === 'afgewezen' || !knopen.some((n) => n.id === k.van) || !knopen.some((n) => n.id === k.naar)) continue
    lijnen.push({ id: k.id, source: k.van, target: k.naar, soort: 'koppeling', koppeling: k.status, afstand: 0 })
  }
  return { knopen, lijnen, skelet: { knopen: knopen.filter((k) => k.soort !== 'link'), lijnen: lijnen.filter((l) => l.soort === 'structuur') } }
}

export function EcosysteemBrein({ data, klantId, klantNaam, kansen, naVerstuurd, maxHoogte = 640, vul = false }: {
  data: Ecosystemen; klantId: string; klantNaam: string
  /** Possible links already sent to the customer's app, and a refresh after sending one. */
  kansen: Kans[]; naVerstuurd: () => void
  maxHoogte?: number; vul?: boolean
}) {
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null)
  const [gekozen, setGekozen] = useState<string | null>(null)
  const [dialoog, setDialoog] = useState<Link | null>(null)
  const sluitDialoog = useCallback(() => setDialoog(null), [])
  const kansVan = new Map(kansen.map((k) => [k.link.id, k]))
  const [filter, setFilter] = useState<Record<LinkStatus, boolean>>({ actief: true, gekend: true, mogelijk: true })
  const [redenering, setRedenering] = useState(true)

  // Only re-layout when the structure changes, not on every poll
  const sleutel = JSON.stringify([data.clusters.map((c) => c.links.map((l) => l.id + l.status + (l.score ?? ''))), data.verbanden.map((v) => v.van + v.naar), (data.koppelingen ?? []).map((k) => k.id + k.status)])
  const graaf = useMemo(() => bouwGraaf(data, klantNaam), [sleutel, klantNaam]) // eslint-disable-line react-hooks/exhaustive-deps
  // Pitch tour: select a node (its reasoning lines light up) and open the send dialog for a possible link
  useBridge((m) => {
    if (m.kateStudio === 'knoop') setGekozen(m.id && graaf.knopen.some((k) => k.id === m.id) ? m.id : null)
    if (m.kateStudio === 'kansSluit') setDialoog(null)
    if (m.kateStudio === 'kans') {
      const paar = data.koppelingen?.find((k) => k.id === m.link)
      if (paar) {
        if (paar.status !== 'mogelijk') return tell({ kateStudio: 'error', error: 'geen_mogelijke_link' })
        setGekozen(paar.van)
        setDialoog(paarAlsLink(paar))
        return
      }
      const link = data.clusters.flatMap((c) => c.links).find((l) => l.id === m.link)
      if (link?.status !== 'mogelijk') return tell({ kateStudio: 'error', error: 'geen_mogelijke_link' })
      setGekozen(link.id)
      setDialoog(link)
    }
  }, [graaf, data])
  const canvas = useGraafCanvas<Knoop, Lijn>({
    graaf: graaf.skelet, maxHoogte, vul,
    krachten: (s, lijnen) => s
      .force('link', forceLink<Knoop, Lijn>(lijnen).id((k) => k.id).distance((l) => l.afstand).strength(0.6))
      .force('lading', forceManyBody<Knoop>().strength((k) => (k.soort === 'hub' ? -220 - (k.bloem?.length ?? 0) * 25 : k.soort === 'klant' ? -250 : -100)))
      .force('botsing', forceCollide<Knoop>().radius((k) => (k.soort === 'hub' ? Math.max(k.r + 22, k.naam.length * 3.4, (k.bloemStraal ?? 0) + 36) : k.r + 30)).iterations(3))
      .force('x', forceX(0).strength(0.04))
      .force('y', forceY(0).strength(0.06)),
    omvang: (k) => (k.bloemStraal ? k.bloemStraal + 14 : 0),
    sleepbaar: (k) => k.soort === 'hub' || k.soort === 'moment',
    kies: (k) => {
      setGekozen(k && k.soort !== 'klant' ? k.id : null)
      // A possible link that wasn't sent yet: offer to send it to the customer's app right away
      if (k?.link?.status === 'mogelijk' && !kansVan.has(k.id)) setDialoog(k.link)
    },
  })
  const { wrap, svg, wrapStijl, breedte, hoogte, zicht } = canvas

  const zichtbaar = (k: Knoop) => !k.status || k.soort === 'hub' || filter[k.status]
  plaatsBloemen(graaf.skelet.knopen, zichtbaar)
  const knoopVan = new Map(graaf.knopen.map((k) => [k.id, k]))
  const lijnen = graaf.lijnen.filter((l) => {
    const a = knoopVan.get(id(l.source!))!, b = knoopVan.get(id(l.target!))!
    return zichtbaar(a) && zichtbaar(b) && (l.soort === 'structuur' || l.soort === 'koppeling' || redenering)
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
    <div className={`grid gap-4 xl:grid-cols-[1fr_300px] ${vul ? 'h-full min-h-0' : ''}`}>
      <div className={`min-w-0 ${vul ? 'flex min-h-[420px] flex-col' : ''}`}>
        {/* Legend + filters in one row above the graph */}
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <StatusFilter filter={filter} zet={setFilter} tel={tel} />
          <label className="ml-1 inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
            <input type="checkbox" checked={redenering} onChange={(e) => setRedenering(e.target.checked)} className="accent-kbc-600" />
            Redeneerlijnen
          </label>
          <ZoomKnoppen zoom={canvas.zoom} pas={canvas.pas} />
        </div>

        <div ref={wrap} className={`relative overflow-hidden rounded-xl bg-gradient-to-b from-kbc-50 to-white ring-1 ring-slate-200 ${vul ? 'min-h-0 flex-1' : ''}`} style={wrapStijl}>
          <svg ref={svg} width={breedte} height={hoogte} className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
            {...canvas.svgProps} onPointerLeave={() => setHover(null)}
            role="img" aria-label={`Ecosysteemkaart van ${klantNaam}: ${data.clusters.length} ecosystemen, ${tel('actief')} actieve, ${tel('gekend')} gekende en ${tel('mogelijk')} mogelijke links`}>
            <g transform={canvas.transform}>
              {lijnen.map((l) => {
                const a = knoopVan.get(id(l.source!))!, b = knoopVan.get(id(l.target!))!
                if (a.x == null || b.x == null) return null
                const o = dim([a.id, b.id])
                if (l.soort === 'koppeling') {
                  // A wider arc than the reasoning lines; solid once the customer agreed
                  const mx = (a.x + b.x) / 2 - (b.y! - a.y!) * 0.3, my = (a.y! + b.y!) / 2 + (b.x - a.x) * 0.3
                  const actief = l.koppeling === 'actief'
                  return <path key={l.id} d={`M${a.x},${a.y}Q${mx},${my} ${b.x},${b.y}`} fill="none" stroke={KOPPELING_KLEUR}
                    strokeWidth={actief ? 3.5 : 2} strokeDasharray={actief ? undefined : l.koppeling === 'voorgesteld' ? '6 4' : '2 4'}
                    strokeLinecap="round" strokeOpacity={buren ? Math.max(o, 0.35) : actief ? 0.95 : 0.7} />
                }
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
                const pos = k.bloemStraal ? { x: 0, y: -(k.bloemStraal + 2), anker: 'middle' as const } : labelBij(k, tekst, k.soort === 'link' ? 3 : 8)
                return (
                  <g key={k.id} transform={`translate(${k.x},${k.y})`} opacity={o} className="cursor-pointer"
                    onPointerDown={(e) => canvas.knoopOmlaag(e, k)}
                    onPointerEnter={(e) => setHover({ id: k.id, ...canvas.naarScherm(e) })}
                    onPointerMove={(e) => hover?.id === k.id && setHover({ id: k.id, ...canvas.naarScherm(e) })}
                    onPointerLeave={() => setHover(null)}>
                    <circle r={k.r + (k.soort === 'link' ? 4 : 8)} fill="transparent" />{/* hit target bigger than the mark */}
                    {k.soort === 'hub' && <circle r={k.r + 5} fill="none" stroke={kleur} strokeWidth={2} strokeDasharray={k.status ? LINK_STREEP[k.status] : undefined} />}
                    {gekozen === k.id && <circle r={k.r + (k.soort === 'hub' ? 10 : 5)} fill="none" stroke={NAVY} strokeWidth={1.5} />}
                    {kansVan.has(k.id) && <circle cx={k.r * 0.8} cy={-k.r * 0.8} r={3.2} fill={NAVY} stroke="#fff" strokeWidth={1.25} />}
                    <circle r={k.r} fill={k.soort === 'hub' || k.soort === 'klant' || k.soort === 'moment' ? NAVY : hol ? '#fff' : kleur}
                      stroke={k.soort === 'moment' ? LINK_KLEUR.mogelijk : hol ? kleur : '#fff'} strokeWidth={2} />
                    {label && (
                      <text x={pos.x} y={pos.y} textAnchor={pos.anker} paintOrder="stroke" stroke="#fff" strokeWidth={3.5} strokeLinejoin="round"
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
          <p className="pointer-events-none absolute bottom-2 left-3 text-[11px] text-slate-400">Scroll om te zoomen · sleep om te verschuiven · klik een mogelijke link om ze naar de app te sturen · ● = verstuurd</p>
        </div>
      </div>

      <div className={vul ? 'min-h-0 overflow-y-auto' : ''}>
        <Detail knoop={gekozenKnoop} data={data} knoopVan={knoopVan} kies={setGekozen} kansVan={kansVan} stuur={setDialoog} />
        {(data.koppelingen ?? []).length > 0 && (
          <p className="mt-2 flex items-center gap-1.5 px-1 text-[11px] text-slate-500">
            <span className="inline-block h-0.5 w-5 rounded" style={{ background: KOPPELING_KLEUR }} /> Partners die samenwerken voor deze klant
          </p>
        )}
      </div>

      {dialoog && (
        <KansDialoog klantId={klantId} klantNaam={klantNaam} link={dialoog} sluit={sluitDialoog} verstuurd={naVerstuurd}
          ecosysteemNaam={data.clusters.find((c) => c.ecosysteem === dialoog.ecosysteem)?.naam ?? dialoog.ecosysteem} />
      )}
    </div>
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

function Detail({ knoop, data, knoopVan, kies, kansVan, stuur }: {
  knoop?: Knoop; data: Ecosystemen; knoopVan: Map<string, Knoop>; kies: (id: string | null) => void; kansVan: Map<string, Kans>; stuur: (l: Link) => void
}) {
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
                  <StatusStip status={l.status} />
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
      {l.status === 'mogelijk' && (kansVan.get(l.id) ? <KansStatusRegel kans={kansVan.get(l.id)!} /> : (
        <button onClick={() => stuur(l)} className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-kbc-800 px-3 py-2 text-sm font-medium text-white hover:bg-kbc-900">
          <Smartphone size={14} /> Stuur naar KBC Mobile
        </button>
      ))}
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
      {l.soort === 'partner' && (data.koppelingen ?? []).filter((k) => k.van === l.id || k.naar === l.id).map((k) => (
        <div key={k.id} className="rounded-lg bg-white p-2 text-xs ring-1" style={{ borderColor: KOPPELING_KLEUR, boxShadow: `inset 3px 0 0 ${KOPPELING_KLEUR}` }}>
          <p className="font-medium text-kbc-800">Samenwerking: {k.naam}</p>
          <p className="text-slate-600">{k.doel}</p>
          {kansVan.get(k.id) ? <div className="mt-1.5"><KansStatusRegel kans={kansVan.get(k.id)!} /></div>
            : k.status === 'actief' ? <p className="mt-1 font-medium text-green-800">Actief: de klant gaf akkoord</p>
            : k.status === 'mogelijk' && (
              <button onClick={() => stuur(paarAlsLink(k))} className="mt-1.5 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-white" style={{ background: KOPPELING_KLEUR }}>
                <Smartphone size={13} /> Voorstel naar KBC Mobile
              </button>
            )}
        </div>
      ))}
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

const KOPPELING_KLEUR = '#7c3aed'

/** A partner pair goes to the app through the same dialog as a possible link: the customer agrees there. */
function paarAlsLink(k: Koppeling): Link {
  return { id: k.id, soort: 'partner', ref: k.id, naam: k.naam, ecosysteem: k.ecosysteem, status: 'mogelijk', waarom: [{ via: k.van, naam: k.naam, reden: k.doel }] }
}

/** Table view of the same clusters, so nothing depends on reading the graph. */
export function ClusterTabel({ data, kansen = [] }: { data: Ecosystemen; kansen?: Kans[] }) {
  const kansVan = new Map(kansen.map((k) => [k.link.id, k]))
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
              <td className="pr-3 align-top">
                <StatusPil status={l.status} />
                {kansVan.get(l.id) && <span className="mt-0.5 flex items-center gap-1 text-xs text-kbc-600"><Smartphone size={11} /> {KANS_STATUS_LABEL[kansVan.get(l.id)!.status]}</span>}
              </td>
              <td className="pr-3 align-top text-xs text-slate-500">{l.herkomst ? HERKOMST_LABEL[l.herkomst] : l.waarom?.map((w) => w.naam).join(', ')}</td>
              <td className="text-right align-top tabular-nums text-slate-600">{l.score != null ? pct(l.score) : ''}</td>
            </tr>
          )))}
        </tbody>
      </table>
    </div>
  )
}
