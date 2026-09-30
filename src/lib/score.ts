import type { Signaal } from '../types'

/**
 * Score history for the chart, replayed from the signals the backend returned.
 * Same rule as the backend's berekenScore (decay off in the demo). The backend stays the source of truth for the
 * current score; this is only used to draw how it got there.
 */
export function scoreVerloop(signalen: Signaal[]): { week: number; score: number }[] {
  const weken = [...new Set(signalen.map((s) => s.week))].sort((a, b) => a - b)
  return weken.map((week) => {
    let niets = 1
    let demping = 1
    for (const s of signalen) {
      if (s.week > week) continue
      if (s.gewicht >= 0) niets *= 1 - s.gewicht
      else demping *= 1 + s.gewicht
    }
    return { week, score: Math.round((1 - niets) * demping * 100) / 100 }
  })
}
