// Public on purpose: judges must be able to log in without asking. Mock data only; must match the backend's DEMO_PASSWORD.
// VITE_DEMO_USER / VITE_DEMO_PASSWORD override it at build time.
export const DEMO_USER: string = import.meta.env.VITE_DEMO_USER || 'adviseur'
export const DEMO_PASSWORD: string = import.meta.env.VITE_DEMO_PASSWORD || 'in4matics-must-win'
