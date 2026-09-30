# KBC Momentum – Backoffice

Backoffice for the KBC Momentum PoC. A KBC employee (role `adviseur`) sees all customers, their detected life moments
(intent score), the signals behind them and the recommended next best action, live as new data comes in.

Spec: [KBC Momentum – Technisch document](https://github.com/in4matics-tectonic/docs/wiki/KBC-Momentum-%E2%80%93-Technisch-document).
Data comes from the [backend API](https://github.com/in4matics-tectonic/backend) (`GET /docs` on the API for the contract).

## Run it

Needs Node ≥ 22, pnpm, and the backend running on `http://127.0.0.1:3000`.

```bash
pnpm install
pnpm dev          # http://localhost:5173
```

Log in as `adviseur` with the demo password (ask the backend owner; it's `DEMO_PASSWORD` in the backend's `.env`).
Customer accounts (`tom`, `lien`, `sarah`) are refused: this app is for KBC staff only.

Config (optional, see `.env.example`):

| Var | Used for |
| --- | --- |
| `BACKEND_URL` | Dev only. Where the Vite proxy sends `/v1/*`. Default `http://127.0.0.1:3000` |
| `VITE_API_URL` | Production build only. Absolute API base if the API isn't served on the same origin. Add this origin to the backend's `CORS_ORIGINS` |

## Screens

| Page | What's on it | Data |
| --- | --- | --- |
| **Moment Radar** | KPI tiles, detected moments per week, funnel signal → handled, channel split, moments table | Portfolio numbers are **simulated** (labelled "Simulatie · mockdata"), see `src/lib/simulatie.ts` |
| | Live signal feed, signals per source, customers with the highest intent | **Live** from the API |
| **Klanten** | Customer list sorted by intent; customer file with products, consent, life landscape, per moment: score meter (40/70/90 thresholds), score history, signal timeline, next best action, playbook, audit trail | **Live** |
| **Auditlog** | Last 100 audit events from the backend | **Live** |

The top bar has the demo controls (**Speel af / Volgende / Reset**), which drive the backend's demo clock
(only when the backend runs with `DEMO_MODE=true`). Everything polls the API every 1.5 s, so the customer app and the
backoffice stay in sync.

## How it works

- Vite + React + TypeScript + Tailwind v4, charts with Recharts, icons from lucide-react. No router, no state library.
- `src/lib/api.ts` – fetch wrapper, login, session. `src/lib/usePoll.ts` – live polling.
- The score and phase are **computed by the backend**. The backoffice never decides them; `src/lib/score.ts` only
  replays the history for the chart.
- The "next best action" card is rule-based per phase (`AdviesKaart.tsx`). The LLM advice card from the tech doc can
  replace the texts later, not the rules.

## Security (PoC level)

- Login against the API; only role `adviseur` is accepted. The JWT lives in `sessionStorage` (cleared when the tab
  closes), never in `localStorage` or the bundle. Auto-logout on token expiry and on any `401`.
- No secrets in this repo or the frontend bundle. The password is only typed in the login form and cleared after submit.
- In dev the API is reached through the Vite proxy (same origin, no CORS needed).
- Health-related (`gevoelig`) signal labels are masked by default; the adviser has to click to reveal them.
- Every read of personal data is logged by the backend and visible in the Auditlog.
- For a real deployment: serve `dist/` behind HTTPS with a strict CSP (`default-src 'self'; connect-src <api>`),
  and put SSO in front instead of shared demo passwords.
