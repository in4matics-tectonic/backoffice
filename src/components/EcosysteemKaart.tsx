import { useCallback, useState } from 'react'
import { Lock, Share2, Unlink } from 'lucide-react'
import type { Ecosystemen, Kans, KlantPartner } from '../types'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'
import { HERKOMST_LABEL } from '../lib/labels'
import { ClusterTabel, EcosysteemBrein } from './EcosysteemBrein'
import { VolScherm, VolSchermKnop } from './graaf'
import { Kaart } from './ui'

/** The customer's ecosystem clusters (graph or table) plus the partners they share data from. Live: the app toggles sharing. */
export function EcosysteemKaart({ klantId, klantNaam }: { klantId: string; klantNaam: string }) {
  const [weergave, setWeergave] = useState<'graaf' | 'lijst'>('graaf')
  const [vol, setVol] = useState(false)
  const sluit = useCallback(() => setVol(false), [])
  const { data, ververs } = usePoll(async () => {
    const [eco, partners, kansen] = await Promise.all([
      api<Ecosystemen>(`/klanten/${klantId}/ecosystemen`),
      api<KlantPartner[]>(`/klanten/${klantId}/partners`),
      api<Kans[]>(`/klanten/${klantId}/kansen`),
    ])
    return { eco, partners, kansen }
  }, 3000, [klantId])

  if (!data) return <Kaart titel="Ecosysteemkaart"><p className="text-sm text-slate-500">Laden…</p></Kaart>
  const relaties = data.partners.filter((p) => p.klantBijPartner)
  const deelt = relaties.filter((p) => p.deelt)
  const gekend = relaties.filter((p) => !p.deelt)

  return (
    <>
      <Kaart titel="Ecosysteemkaart"
        extra={
          <div className="flex items-center gap-2">
            {weergave === 'graaf' && <VolSchermKnop open={() => setVol(true)} />}
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
        <p className="mb-3 text-sm text-slate-500">
          Eén cluster per KBC-ecosysteem. Mogelijke links volgen uit vaste regels op de actieve en gekende links en op bevestigde levensmomenten.
        </p>
        {weergave === 'lijst' ? <ClusterTabel data={data.eco} kansen={data.kansen} />
          : vol ? <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Geopend op volledig scherm.</p>
          : <EcosysteemBrein data={data.eco} klantId={klantId} klantNaam={klantNaam} kansen={data.kansen} naVerstuurd={ververs} />}
      </Kaart>

      {vol && (
        <VolScherm titel={`Ecosysteemkaart · ${klantNaam}`} sub={`${klantId} · ${data.eco.clusters.length} ecosystemen`} sluit={sluit}>
          <EcosysteemBrein data={data.eco} klantId={klantId} klantNaam={klantNaam} kansen={data.kansen} naVerstuurd={ververs} vul />
        </VolScherm>
      )}

      <Kaart titel="Partners van deze klant" extra={<span className="text-xs text-slate-500">{data.partners.length} KBC-partners in totaal</span>}>
        <div className="grid gap-4 md:grid-cols-2">
          <PartnerLijst titel={`Deelt data met KBC (${deelt.length})`} icon={Share2} partners={deelt} leeg="Nog geen partner deelt data." />
          <PartnerLijst titel={`Gekend, geen datadeling (${gekend.length})`} icon={Unlink} partners={gekend} leeg="Geen andere gekende partners." />
        </div>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Lock size={12} /> Alleen de klant zet datadeling aan of uit, in KBC Mobile. Gezondheidspartners worden nooit afgeleid of voorgesteld.
        </p>
      </Kaart>
    </>
  )
}

function PartnerLijst({ titel, icon: Icon, partners, leeg }: { titel: string; icon: typeof Share2; partners: KlantPartner[]; leeg: string }) {
  return (
    <div>
      <h4 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Icon size={14} /> {titel}</h4>
      {partners.length === 0 && <p className="text-sm text-slate-400">{leeg}</p>}
      <ul className="space-y-1.5">
        {partners.map((p) => (
          <li key={p.partner} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
            <span className="font-medium text-kbc-800">{p.naam}</span>
            <span className="text-right text-xs text-slate-500">
              {p.herkomst && HERKOMST_LABEL[p.herkomst]}{p.sinds && ` · sinds ${new Date(p.sinds).toLocaleDateString('nl-BE', { month: 'short', year: 'numeric' })}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
