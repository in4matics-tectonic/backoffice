import type { Bron, Domein, Fase, MomentId } from '../types'

export const MOMENT_LABEL: Record<MomentId, string> = {
  GEZINSUITBREIDING: 'Gezinsuitbreiding',
  HUIS_KOPEN: 'Huis kopen',
  ZAAK_STARTEN: 'Zaak starten',
}

export const BRON_LABEL: Record<Bron, string> = {
  EIGEN_AI: 'Eigen AI (MCP)',
  DOCCLE: 'Doccle',
  GEOFENCE: 'Geofencing',
  APP: 'KBC Mobile',
  REKENING: 'Rekening',
}

export const FASES: Fase[] = ['stil', 'info', 'vragen', 'voorstel']
export const FASE_LABEL: Record<Fase, string> = { stil: 'Stil', info: 'Info', vragen: 'Vragen', voorstel: 'Voorstel' }
// One hue, light -> dark: later phase = stronger intent
export const FASE_KLEUR: Record<Fase, string> = { stil: '#cdeefb', info: '#66cef5', vragen: '#0097db', voorstel: '#0d2a50' }
export const DREMPELS = { info: 0.4, vragen: 0.7, voorstel: 0.9 }

export const DOMEIN_LABEL: Record<Domein, string> = {
  huis: 'Huis', gezin: 'Gezin', auto: 'Auto', bescherming: 'Bescherming', sparen: 'Sparen', gezondheid: 'Gezondheid', reizen: 'Reizen',
}

export const pct = (n: number) => `${Math.round(n * 100)}%`
export const eur = (n: number) => n.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })
