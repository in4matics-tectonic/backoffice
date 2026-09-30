// Portfolio-level numbers for the pitch. There is no real KBC data behind these: the UI labels them "Simulatie".
// Everything per customer (scores, signals, audit) comes live from the API.

export const SIM_KPI = {
  klantenInScope: '2,3 M',
  momenten7d: 19247,
  stp: 0.72,
  bevestigd: 0.81,
  correcties: 3412,
}

export const SIM_MOMENTEN = [
  { moment: 'Verhuis', playbook: 'Adres · woonverzekering · energie · Kate Coin', aantal: 4212, zekerheid: 0.86, stp: 0.71 },
  { moment: 'Gezinsuitbreiding', playbook: 'Spaarrekening kind · hospitalisatie · kinderbijslag-check', aantal: 1845, zekerheid: 0.82, stp: 0.64 },
  { moment: 'Nieuwe wagen', playbook: 'Autolening · omnium · laadpaal', aantal: 2930, zekerheid: 0.89, stp: 0.78 },
  { moment: 'Eerste job', playbook: 'Budgetcoach · eerste belegging · familiale', aantal: 3108, zekerheid: 0.84, stp: 0.82 },
  { moment: 'KMO: eerste werknemer', playbook: 'Loonrekening · arbeidsongevallen · KUBE', aantal: 412, zekerheid: 0.78, stp: 0.55 },
]

// Detected moments per week, last 12 weeks, stacked by type
const basis = [
  [3100, 1500, 2400, 2600, 300], [3300, 1560, 2500, 2700, 320], [3250, 1620, 2450, 2800, 330], [3500, 1600, 2600, 2750, 350],
  [3700, 1680, 2700, 2900, 360], [3650, 1720, 2650, 3000, 370], [3900, 1700, 2800, 2950, 380], [4000, 1760, 2850, 3050, 390],
  [3950, 1800, 2900, 3100, 395], [4100, 1790, 2880, 3020, 400], [4150, 1830, 2950, 3080, 405], [4212, 1845, 2930, 3108, 412],
]
export const SIM_TREND = basis.map(([verhuis, gezin, wagen, job, kmo], i) => ({
  week: `W${29 + i}`, Verhuis: verhuis, Gezinsuitbreiding: gezin, 'Nieuwe wagen': wagen, 'Eerste job': job, KMO: kmo,
}))

export const SIM_TREND_KEYS = ['Verhuis', 'Gezinsuitbreiding', 'Nieuwe wagen', 'Eerste job', 'KMO'] as const

// Funnel: from raw signal to handled moment (this week)
export const SIM_FUNNEL = [
  { stap: 'Signaal ontvangen', aantal: 48210 },
  { stap: 'Moment ≥ 40% (info)', aantal: 19247 },
  { stap: 'Vraag gesteld (≥ 70%)', aantal: 11380 },
  { stap: 'Bevestigd door klant', aantal: 9218 },
  { stap: 'Plan afgehandeld', aantal: 6637 },
]

export const SIM_KANAAL = [
  { naam: 'Kate regelt (STP)', waarde: 72 },
  { naam: 'Info in app', waarde: 19 },
  { naam: 'Adviseur', waarde: 9 },
]
