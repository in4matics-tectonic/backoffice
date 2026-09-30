export function Kaart({ titel, children, extra, className = '' }: { titel?: string; children: React.ReactNode; extra?: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 ${className}`}>
      {(titel || extra) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {titel && <h3 className="font-semibold text-kbc-800">{titel}</h3>}
          {extra}
        </div>
      )}
      {children}
    </section>
  )
}

export function SimBadge() {
  return <span className="shrink-0 whitespace-nowrap rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900">Simulatie · mockdata</span>
}

export function LiveBadge() {
  return <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-700"><span className="size-2 animate-pulse rounded-full bg-kbc-green" /> live</span>
}

export function Kpi({ label, waarde, sub, kleur = 'text-kbc-800' }: { label: string; waarde: string; sub: string; kleur?: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${kleur}`}>{waarde}</p>
      <p className="mt-1 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
