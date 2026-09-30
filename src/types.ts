// Mirrors the backend contract (see GET /docs on the API). Dutch field names on purpose.
export type Bron = 'EIGEN_AI' | 'DOCCLE' | 'GEOFENCE' | 'APP' | 'REKENING'
export type MomentId = 'GEZINSUITBREIDING' | 'HUIS_KOPEN' | 'ZAAK_STARTEN'
export type Domein = 'huis' | 'gezin' | 'auto' | 'bescherming' | 'sparen' | 'gezondheid' | 'reizen'
export type DomeinStatus = 'geregeld' | 'kans' | 'nieuw'
export type Fase = 'stil' | 'info' | 'vragen' | 'voorstel'

export interface User { sub: string; role: string; klantId?: string }

export interface KlantKort { id: string; naam: string }

export interface Klant extends KlantKort {
  toestemming: Record<Bron, boolean>
  producten: string[]
  landschap: Record<Domein, DomeinStatus>
}

export interface Signaal {
  id: string
  week: number
  bron: Bron
  moment: MomentId
  gewicht: number
  label: string
  gevoelig: boolean
}

export interface PlaybookActie {
  id: string
  titel: string
  domein: Domein
  uitvoering: 'STP' | 'INFO' | 'ADVISEUR'
  kateCoin?: { bedrag: number; voorwaarde: string }
}

export interface Moment {
  moment: MomentId
  score: number
  fase: Fase
  bevestigd: boolean
  signalen: string[]
  acties: PlaybookActie[]
  signalenDetail: Signaal[]
}

export interface Momenten { week: number; momenten: Moment[] }
export interface Product { code: string; naam: string }
export interface Rekening { id: string; iban: string; type: string; naam: string; saldo: number }
export interface AuditEvent { ts: string; actor: string; actie: string; klantId?: string; detail?: string }
export interface Demo { week: number; weken: number[] }
