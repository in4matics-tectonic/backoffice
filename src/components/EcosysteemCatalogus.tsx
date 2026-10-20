import { useState } from 'react'
import { ChevronRight, Search } from 'lucide-react'
import type { Catalogus, Ecosystemen, KlantKort, LinkStatus } from '../types'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { LINK_KLEUR, LINK_LABEL } from '../lib/labels'
import { Kaart, Kpi, LiveBadge } from './ui'

const STATUSSEN: LinkStatus[] = ['actief', 'gekend', 'mogelijk']

/** The KBC catalogue (ecosystems, products, partners) and, live, where each customer stands in every ecosystem. */
export function EcosysteemCatalogus({ klanten, openKlant }: { klanten: KlantKort[]; openKlant: (id: string) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const [zoek, setZoek] = useState('')
  const { data: cat } = usePoll(() => api<Catalogus>('/catalogus'), 5 * 60_000)
  const { data: perKlant } = usePoll(
    async () => Promise.all(klanten.map(async (k) => ({ klant: k, eco: await api<Ecosystemen>(`/klanten/${k.id}/ecosystemen`) }))),
    5000, [klanten.map((k) => k.id).join()],
  )

  if (!cat) return <p className="text-slate-500">Catalogus laden…</p>
  const partnerNaam = new Map(cat.partners.map((p) => [p.id, p.naam]))
  const q = zoek.trim().toLowerCase()
  const treft = (naam: string) => !q || naam.toLowerCase().includes(q)
  const ecosystemen = cat.ecosystemen.filter((e) => treft(e.naam) || cat.producten.some((p) => p.ecosysteem === e.id && (treft(p.naam) || p.partners.some((x) => treft(partnerNaam.get(x)!)))))
  const status = (klantEco: Ecosystemen, eco: string) => klantEco.clusters.find((c) => c.ecosysteem === eco)?.status
  const totaal = (s: LinkStatus) => (perKlant ?? []).reduce((n, k) => n + k.eco.samenvatting[s], 0)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-kbc-800">Ecosystemen</h1>
          <p className="text-sm text-slate-500">Alle KBC-producten, -diensten en partners, en waar elke klant staat per ecosysteem</p>
        </div>
        <label className="flex w-full items-center gap-2 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200 focus-within:ring-kbc-400 sm:w-80">
          <Search size={16} className="text-slate-400" />
          <input value={zoek} onChange={(e) => setZoek(e.target.value)} placeholder="Zoek ecosysteem, product of partner" className="w-full bg-transparent text-sm outline-none" />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Ecosystemen" waarde={String(cat.ecosystemen.length)} sub="van wonen tot internationaal ondernemen" />
        <Kpi label="Producten en diensten" waarde={String(cat.producten.length)} sub={`waarvan ${cat.producten.filter((p) => p.kanaal === 'B2B').length} B2B-integraties voor partners`} />
        <Kpi label="Partners" waarde={String(cat.partners.length)} sub={`${cat.partners.filter((p) => p.gevoelig).length} gezondheidspartners nooit afgeleid`} />
        <Kpi label="Links over alle klanten" waarde={perKlant ? `${totaal('actief')} · ${totaal('gekend')} · ${totaal('mogelijk')}` : '…'} sub="actief · gekend · mogelijk" kleur="text-kbc-600" />
      </div>

      <Kaart titel="Catalogus per ecosysteem" extra={<span className="flex items-center gap-3"><StatusLegende /><LiveBadge /></span>}>
        <ul className="divide-y divide-slate-100">
          {ecosystemen.map((e) => {
            const producten = cat.producten.filter((p) => p.ecosysteem === e.id && (treft(e.naam) || treft(p.naam) || p.partners.some((x) => treft(partnerNaam.get(x)!))))
            const isOpen = open === e.id || (q !== '' && producten.length > 0)
            return (
              <li key={e.id}>
                <button onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={isOpen}
                  className="flex w-full flex-wrap items-center gap-3 py-3 text-left hover:bg-kbc-50/60">
                  <ChevronRight size={16} className={`text-slate-400 transition ${isOpen ? 'rotate-90' : ''}`} />
                  <span className="min-w-48 flex-1 font-medium text-kbc-800">{e.naam}</span>
                  <span className="w-24 text-xs tabular-nums text-slate-500">{e.aantalProducten} producten</span>
                  <span className="w-24 text-xs tabular-nums text-slate-500">{e.partners.length} partners</span>
                  <span className="flex gap-1.5">
                    {(perKlant ?? []).map(({ klant, eco }) => {
                      const s = status(eco, e.id)
                      return (
                        <span key={klant.id} title={`${klant.naam}: ${s ? LINK_LABEL[s] : 'geen link'}`}
                          className={`rounded-full px-2 py-0.5 text-[11px] ring-1 ${s ? 'bg-white text-slate-700' : 'text-slate-300 ring-slate-100'}`}
                          style={s ? { boxShadow: `inset 0 0 0 1.5px ${LINK_KLEUR[s]}` } : undefined}>
                          {klant.naam.split(' ')[0]}
                        </span>
                      )
                    })}
                  </span>
                </button>
                {isOpen && (
                  <div className="mb-3 ml-7 grid gap-x-6 gap-y-1 sm:grid-cols-2 xl:grid-cols-3">
                    {producten.map((p) => (
                      <div key={p.id} className="flex items-baseline justify-between gap-2 border-b border-slate-50 py-1 text-sm">
                        <span className="text-slate-700">{p.naam}</span>
                        <span className="flex shrink-0 gap-1">
                          {p.partners.map((x) => <span key={x} className="rounded bg-kbc-100 px-1.5 text-[11px] text-kbc-800">{partnerNaam.get(x)}</span>)}
                          {p.kanaal === 'B2B' && <span className="rounded bg-slate-100 px-1.5 text-[11px] text-slate-500">B2B</span>}
                        </span>
                      </div>
                    ))}
                    {(perKlant ?? []).some(({ eco }) => status(eco, e.id)) && (
                      <div className="col-span-full mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        Klanten in dit ecosysteem:
                        {(perKlant ?? []).filter(({ eco }) => status(eco, e.id)).map(({ klant, eco }) => (
                          <button key={klant.id} onClick={() => openKlant(klant.id)} className="font-medium text-kbc-600 hover:underline">
                            {klant.naam} ({LINK_LABEL[status(eco, e.id)!].toLowerCase()})
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        {ecosystemen.length === 0 && <p className="py-4 text-sm text-slate-500">Niets gevonden voor “{zoek}”.</p>}
      </Kaart>
    </div>
  )
}

function StatusLegende() {
  return (
    <span className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
      {STATUSSEN.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <span className="size-2.5 rounded-full" style={{ boxShadow: `inset 0 0 0 1.5px ${LINK_KLEUR[s]}` }} /> {LINK_LABEL[s]}
        </span>
      ))}
    </span>
  )
}
