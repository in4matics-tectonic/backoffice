import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, ShieldAlert } from 'lucide-react'
import type { Bron, Moment } from '../types'
import type { KlantRij } from './KlantLijst'
import { BRON_LABEL, MOMENT_LABEL, pct } from '../lib/labels'
import { SIM_FUNNEL, SIM_KANAAL, SIM_KPI, SIM_MOMENTEN, SIM_TREND, SIM_TREND_KEYS } from '../lib/simulatie'
import { KANAAL_KLEUR, REEKS } from '../lib/kleuren'
import { BRON_ICON } from './icons'
import { Kaart, Kpi, LiveBadge, SimBadge } from './ui'
import { FaseBadge } from './FaseBadge'
import { ScoreMeter } from './ScoreMeter'

const nl = (n: number) => n.toLocaleString('nl-BE')
const tooltipStijl = { borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgb(0 0 0 / .12)', fontSize: 12 }

export function Radar({ rijen, week, openKlant }: { rijen: KlantRij[]; week: number; openKlant: (id: string) => void }) {
  const signalen = rijen.flatMap((k) => k.momenten.flatMap((m) => m.signalenDetail.map((s) => ({ ...s, klant: k }))))
  const feed = [...signalen].sort((a, b) => b.week - a.week || b.id.localeCompare(a.id)).slice(0, 7)
  const perBron = (Object.keys(BRON_LABEL) as Bron[]).map((b) => ({ bron: BRON_LABEL[b], aantal: signalen.filter((s) => s.bron === b).length }))
  const leads = rijen
    .flatMap((k) => k.momenten.map((m) => ({ klant: k, m })))
    .sort((a, b) => b.m.score - a.m.score)
  const funnelMax = SIM_FUNNEL[0].aantal

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold text-kbc-800">Moment Radar</h1>
          <p className="text-sm text-slate-500">Levensmomenten live gedetecteerd over alle klanten, afgehandeld door Kate</p>
        </div>
        <div className="flex items-center gap-2">
          <SimBadge />
          <span className="rounded-full bg-white px-3 py-1 text-sm font-medium ring-1 ring-slate-200">Demoweek {week}</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Klanten in scope" waarde={SIM_KPI.klantenInScope} sub="met actieve ‘Op jouw maat’-toestemming" />
        <Kpi label="Momenten gedetecteerd (7d)" waarde={nl(SIM_KPI.momenten7d + signalen.length)} sub="over 5 actieve playbooks" />
        <Kpi label="STP-afhandeling" waarde={pct(SIM_KPI.stp)} sub="zonder menselijke tussenkomst" kleur="text-green-700" />
        <Kpi label="Bevestigd door klant" waarde={pct(SIM_KPI.bevestigd)} sub="‘Klopt’ op Waarom zie ik dit?" kleur="text-kbc-600" />
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Kaart titel="Gedetecteerde momenten per week" extra={<SimBadge />} className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={SIM_TREND} margin={{ left: -10, right: 8, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#eef2f6" />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip contentStyle={tooltipStijl} formatter={(v) => nl(Number(v))} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                {SIM_TREND_KEYS.map((k, i) => (
                  <Area key={k} type="monotone" dataKey={k} stackId="1" stroke={REEKS[i]} strokeWidth={2} fill={REEKS[i]} fillOpacity={0.18} isAnimationActive={false} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Kaart>

        <Kaart titel="Live signalen" extra={<LiveBadge />}>
          {feed.length === 0 && <p className="text-sm text-slate-500">Wachten op signalen… Druk op <b>Speel af</b>.</p>}
          <ul className="divide-y divide-slate-100">
            {feed.map((s) => {
              const Icon = BRON_ICON[s.bron]
              return (
                <li key={`${s.klant.id}-${s.id}`} className="slide-in py-2">
                  <button onClick={() => openKlant(s.klant.id)} className="flex w-full items-start gap-2.5 text-left">
                    <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-kbc-100 text-kbc-600"><Icon size={15} /></div>
                    <div className="min-w-0 text-sm">
                      <p><b className="text-kbc-800">{MOMENT_LABEL[s.moment]}</b> · gewicht {s.gewicht.toFixed(2)}</p>
                      <p className="truncate text-xs text-slate-500">
                        wk {s.week} · {s.klant.naam} · {s.gevoelig
                          ? <span className="inline-flex items-center gap-0.5 text-amber-700"><ShieldAlert size={11} /> gevoelig signaal</span>
                          : s.label}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Kaart>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Kaart titel="Van signaal tot afgehandeld" extra={<SimBadge />}>
          <ul className="space-y-2.5">
            {SIM_FUNNEL.map((f, i) => (
              <li key={f.stap}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-600">{f.stap}</span>
                  <span className="font-medium tabular-nums">{nl(f.aantal)}{i > 0 && <span className="ml-1 text-slate-400">({pct(f.aantal / SIM_FUNNEL[i - 1].aantal)})</span>}</span>
                </div>
                <div className="h-5 rounded bg-slate-100">
                  <div className="h-full rounded" style={{ width: `${(f.aantal / funnelMax) * 100}%`, background: ['#cdeefb', '#66cef5', '#00aeef', '#0097db', '#0d2a50'][i] }} />
                </div>
              </li>
            ))}
          </ul>
        </Kaart>

        <Kaart titel="Afhandeling per kanaal" extra={<SimBadge />}>
          <div className="flex items-center gap-4">
            <div className="h-44 w-44 shrink-0">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={SIM_KANAAL} dataKey="waarde" nameKey="naam" innerRadius={48} outerRadius={78} paddingAngle={2} stroke="#fff" strokeWidth={2} isAnimationActive={false}>
                    {SIM_KANAAL.map((_, i) => <Cell key={i} fill={KANAAL_KLEUR[i]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStijl} formatter={(v) => `${v}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2 text-sm">
              {SIM_KANAAL.map((k, i) => (
                <li key={k.naam} className="flex items-center gap-2">
                  <span className="size-3 rounded-full" style={{ background: KANAAL_KLEUR[i] }} />
                  <span className="text-slate-600">{k.naam}</span>
                  <b className="tabular-nums">{k.waarde}%</b>
                </li>
              ))}
            </ul>
          </div>
        </Kaart>

        <Kaart titel="Signalen per bron" extra={<LiveBadge />}>
          <div className="h-44">
            <ResponsiveContainer>
              <BarChart data={perBron} layout="vertical" margin={{ left: 10, right: 16 }}>
                <XAxis type="number" allowDecimals={false} hide />
                <YAxis type="category" dataKey="bron" width={100} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStijl} cursor={{ fill: '#f3f8fc' }} />
                <Bar dataKey="aantal" name="Signalen" fill="#0097db" radius={[0, 4, 4, 0]} barSize={14} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Kaart>
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Kaart titel="Momenten deze week" extra={<SimBadge />} className="xl:col-span-2 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="pb-2 font-medium">Moment</th><th className="font-medium">Playbook</th><th className="pl-4 text-right font-medium">Aantal</th><th className="pl-4 text-right font-medium">Zekerheid</th><th className="pl-4 font-medium">STP</th></tr>
            </thead>
            <tbody>
              {SIM_MOMENTEN.map((m) => (
                <tr key={m.moment} className="border-t border-slate-100">
                  <td className="py-2.5 font-medium text-kbc-800">{m.moment}</td>
                  <td className="text-xs text-slate-500">{m.playbook}</td>
                  <td className="text-right tabular-nums">{nl(m.aantal)}</td>
                  <td className="text-right tabular-nums">{m.zekerheid.toFixed(2).replace('.', ',')}</td>
                  <td className="pl-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-24 rounded-full bg-slate-100"><div className="h-full rounded-full bg-green-700" style={{ width: pct(m.stp) }} /></div>
                      <span className="text-xs tabular-nums">{pct(m.stp)}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Kaart>

        <div className="space-y-5">
          <Kaart titel="Hoogste intentie nu" extra={<LiveBadge />}>
            {leads.length === 0 && <p className="text-sm text-slate-500">Nog geen actieve momenten.</p>}
            <ul className="space-y-2">
              {leads.slice(0, 5).map(({ klant, m }: { klant: KlantRij; m: Moment }) => (
                <li key={`${klant.id}-${m.moment}`}>
                  <button onClick={() => openKlant(klant.id)} className="group w-full rounded-xl p-2 text-left hover:bg-kbc-50">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-kbc-800">{klant.naam}</span>
                      <span className="flex items-center gap-2"><FaseBadge fase={m.fase} /><b className="tabular-nums">{pct(m.score)}</b></span>
                    </div>
                    <p className="mb-1 flex items-center gap-1 text-xs text-slate-500">{MOMENT_LABEL[m.moment]} <ArrowRight size={11} className="opacity-0 group-hover:opacity-100" /></p>
                    <ScoreMeter score={m.score} fase={m.fase} />
                  </button>
                </li>
              ))}
            </ul>
          </Kaart>
          <section className="rounded-2xl bg-kbc-800 p-5 text-white">
            <p className="text-xs text-kbc-100/70">Feedbackloop deze week</p>
            <p className="mt-1 text-3xl font-semibold">{nl(SIM_KPI.correcties)} correcties</p>
            <p className="mt-1 text-sm text-kbc-100/80">Elke “Niet voor mij” verfijnt het moment voor die klant én het model voor iedereen.</p>
          </section>
        </div>
      </div>
    </div>
  )
}
