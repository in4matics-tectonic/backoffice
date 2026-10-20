// Mirrors the backend contract (see GET /docs on the API). Dutch field names on purpose.
export type Bron = 'EIGEN_AI' | 'DOCCLE' | 'GEOFENCE' | 'APP' | 'REKENING'
export type MomentId = 'GEZINSUITBREIDING' | 'HUIS_KOPEN' | 'TROUWEN' | 'ZAAK_STARTEN' | 'ZAAK_UITBREIDEN'
export type Domein = 'huis' | 'gezin' | 'auto' | 'bescherming' | 'sparen' | 'gezondheid' | 'reizen' | 'onderneming'
export type DomeinStatus = 'geregeld' | 'kans' | 'nieuw'
export type Fase = 'stil' | 'info' | 'vragen' | 'voorstel'

export interface User { sub: string; role: string; klantId?: string }

export interface KlantKort { id: string; naam: string; onderneming?: string | null }

export interface Onderneming {
  naam: string; ondernemingsnummer: string; sector: string; omschrijving: string; opgericht: string; werknemers: number
}

export interface Klant {
  id: string
  naam: string
  onderneming?: Onderneming
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

// ---- Ecosystems & partners (GET /catalogus, /klanten/:id/partners, /klanten/:id/ecosystemen) ----
export type LinkStatus = 'actief' | 'gekend' | 'mogelijk'
export type Herkomst = 'REKENING' | 'KBC_MOBILE' | 'KLANT' | 'KBC_PRODUCT'
export type NodeId = string // 'product:<id>' | 'partner:<id>'

export interface EcosysteemKort { id: string; naam: string; aantalProducten: number; partners: string[] }
export interface CatalogusProduct { id: string; naam: string; ecosysteem: string; partners: string[]; kanaal: 'KLANT' | 'B2B' }
export interface PartnerInfo { id: string; naam: string; ecosysteem: string; ecosystemen: string[]; producten: string[]; gevoelig: boolean }
export interface Catalogus { ecosystemen: EcosysteemKort[]; producten: CatalogusProduct[]; partners: PartnerInfo[] }

export interface KlantPartner {
  partner: string; naam: string; ecosysteem: string; gevoelig: boolean
  klantBijPartner: boolean; deelt: boolean; herkomst: Herkomst | null; sinds: string | null
}

export interface Waarom { via: string; naam: string; reden: string }
export interface Link {
  id: NodeId; soort: 'product' | 'partner'; ref: string; naam: string; ecosysteem: string
  status: LinkStatus; herkomst?: Herkomst; sinds?: string; score?: number; waarom?: Waarom[]
}
export interface Cluster { ecosysteem: string; naam: string; status: LinkStatus; links: Link[] }
export interface Verband { van: string; naar: NodeId; gewicht: number }
export interface Ecosystemen {
  week: number
  samenvatting: { actief: number; gekend: number; mogelijk: number; ecosystemen: number; nieuweEcosystemen: string[] }
  clusters: Cluster[]
  verbanden: Verband[]
}

// ---- Kansen: possible links an adviser sent to the customer's app (GET/POST /klanten/:id/kansen) ----
export type KansStatus = 'nieuw' | 'gezien' | 'interesse' | 'afgewezen'
export interface Kans {
  id: string
  klantId: string
  link: { id: NodeId; soort: 'product' | 'partner'; ref: string; naam: string; ecosysteem: string; ecosysteemNaam: string }
  score: number
  waarom: string[]
  bericht: string | null
  status: KansStatus
  verstuurdDoor: string
  verstuurdOp: string
  bijgewerktOp: string
}
