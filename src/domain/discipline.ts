import type { Snapshot } from './models'
import { addDays, localDate } from './dates'
import { sessionProgress } from './training'

export const AURAS = [
  { min: 0, name: 'Sans aura', color: 'none' },
  { min: 5, name: 'Éveil', color: 'blue' },
  { min: 15, name: 'Ascension', color: 'violet' },
  { min: 30, name: 'Transcendance', color: 'cyan' },
  { min: 50, name: 'Domination', color: 'gold' },
  { min: 100, name: 'Immortel', color: 'rose' },
] as const

export function auraFor(streak: number) { return AURAS.filter(aura => streak >= aura.min).at(-1)! }
export type DisciplineDay = {
  date: string; status: 'succeeded' | 'failed' | 'pending'
  reason: 'complete' | 'dietMissing' | 'dietNotRequired' | 'dietFailed' | 'dietUnreported' | 'training'
  completedSessions: number; requiredSessions: number
}

/** A projection of persisted civil dates and frozen weekly plans, never an XP input.
 * Past incomplete days break the chain, but permitted late corrections recompute it.
 * Today remains pending until complete, including when its diet is marked failed.
 * Missing diet configuration/non-required diet days cannot silently count as success.
 */
export function calculateDiscipline(data: Pick<Snapshot, 'weeks' | 'dailyChecks' | 'trainingChecks'>, today = localDate(new Date())) {
  const weeks = [...data.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate))
  const start = weeks.find(week => week.dietSnapshot && week.startDate <= today)?.startDate ?? today
  const checks = new Map(data.dailyChecks.map(check => [`${check.weekId}:${check.habitId}:${check.date}`, check.state]))
  const training = new Map<string, Snapshot['trainingChecks']>()
  for (const check of data.trainingChecks) {
    const values = training.get(check.weekId) ?? []
    values.push(check); training.set(check.weekId, values)
  }
  const days: DisciplineDay[] = []
  let weekIndex = 0, current = 0, best = 0
  for (let date = start; date <= today; date = addDays(date, 1)) {
    while (weekIndex + 1 < weeks.length && weeks[weekIndex + 1].startDate <= date) weekIndex++
    const candidate = weeks[weekIndex]
    const week = candidate && candidate.startDate <= date && date < addDays(candidate.startDate, 7) ? candidate : undefined
    const sessions = week?.snapshot.filter(session => session.date === date) ?? []
    const completedSessions = sessions.filter(session => sessionProgress(session, training.get(week!.id) ?? []).status === 'completed').length
    const diet = week?.dietSnapshot
    const dietApplies = diet?.requiredDays.some(day => addDays(week!.startDate, day - 1) === date)
    const state = diet && week ? checks.get(`${week.id}:${diet.id}:${date}`) : undefined
    const reason: DisciplineDay['reason'] = !diet ? 'dietMissing' : !dietApplies ? 'dietNotRequired' : state === 'failed' ? 'dietFailed' : state !== 'respected' ? 'dietUnreported' : completedSessions !== sessions.length ? 'training' : 'complete'
    const status = reason === 'complete' ? 'succeeded' : date === today ? 'pending' : 'failed'
    if (status === 'succeeded') { current++; best = Math.max(best, current) }
    else if (status === 'failed') current = 0
    days.push({ date, status, reason, completedSessions, requiredSessions: sessions.length })
  }
  const aura = auraFor(current), nextAura = AURAS.find(value => value.min > current) ?? null
  return { current, best, days, today: days.at(-1)!, aura, nextAura }
}
