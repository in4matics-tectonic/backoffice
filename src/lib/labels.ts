import type { Bron, Domein, Fase, Herkomst, LinkStatus, MomentId } from '../types'

export const MOMENT_LABEL: Record<MomentId, string> = {
  GEZINSUITBREIDING: 'Gezinsuitbreiding',
  HUIS_KOPEN: 'Huis kopen',
  TROUWEN: 'Trouwen',
  ZAAK_STARTEN: 'Zaak starten',
  ZAAK_UITBREIDEN: 'Zaak uitbreiden',
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
  huis: 'Huis', gezin: 'Gezin', auto: 'Auto', bescherming: 'Bescherming', sparen: 'Sparen', gezondheid: 'Gezondheid', reizen: 'Reizen', onderneming: 'Onderneming',
}

export const pct = (n: number) => `${Math.round(n * 100)}%`
export const eur = (n: number) => n.toLocaleString('nl-BE', { style: 'currency', currency: 'EUR' })

// Ecosystem links. Hues validated with the dataviz palette checker; the line style (solid/dashed/dotted) and
// filled/hollow nodes carry the same meaning, so status is never color-only.
export const LINK_LABEL: Record<LinkStatus, string> = { actief: 'Actief', gekend: 'Gekend', mogelijk: 'Mogelijk' }
export const LINK_UITLEG: Record<LinkStatus, string> = {
  actief: 'KBC-product of partner die data deelt met KBC',
  gekend: 'Klant bij partner, zonder datadeling',
  mogelijk: 'Product of partner die de klant kan nodig hebben',
}
export const LINK_KLEUR: Record<LinkStatus, string> = { actief: '#5ea32a', gekend: '#0097db', mogelijk: '#e09a00' }
export const LINK_STREEP: Record<LinkStatus, string | undefined> = { actief: undefined, gekend: '6 4', mogelijk: '1.5 4' }
export const HERKOMST_LABEL: Record<Herkomst, string> = {
  KBC_PRODUCT: 'KBC-product',
  REKENING: 'Gezien op de rekening',
  KBC_MOBILE: 'Gebruikt in KBC Mobile',
  KLANT: 'Zelf toegevoegd door klant',
}
