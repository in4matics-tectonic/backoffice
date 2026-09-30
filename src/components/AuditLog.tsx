import type { AuditEvent } from '../types'
import { api } from '../lib/api'
import { usePoll } from '../lib/usePoll'

export function AuditLog({ klantId, max = 12 }: { klantId?: string; max?: number }) {
  const { data } = usePoll(() => api<AuditEvent[]>('/audit'), 4000, [])
  const events = (data ?? []).filter((e) => !klantId || e.klantId === klantId).slice(0, max)
  if (events.length === 0) return <p className="text-sm text-slate-500">Nog geen gebeurtenissen.</p>
  return (
    <table className="w-full text-left text-xs">
      <thead className="text-slate-500"><tr><th className="py-1 font-medium">Tijd</th><th className="font-medium">Wie</th><th className="font-medium">Actie</th>{!klantId && <th className="font-medium">Klant</th>}<th className="font-medium">Detail</th></tr></thead>
      <tbody>
        {events.map((e, i) => (
          <tr key={`${e.ts}-${i}`} className="border-t border-slate-100">
            <td className="py-1 tabular-nums text-slate-500">{new Date(e.ts).toLocaleTimeString('nl-BE')}</td>
            <td>{e.actor}</td><td>{e.actie}</td>{!klantId && <td className="text-slate-500">{e.klantId}</td>}<td className="text-slate-500">{e.detail}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
