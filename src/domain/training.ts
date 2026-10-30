import type { PlannedSession, Records, Snapshot } from './models'
import { addDays, weekStart } from './dates'

export const weekdays = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche']
export function entityMeta() { const now = new Date().toISOString(); return { id: crypto.randomUUID(), createdAt: now, updatedAt: now } }
export function newSet() { return { id: crypto.randomUUID(), reps: 10, durationSeconds: null, weightKg: null } }
export function newSession(weekday = 1): PlannedSession {
  const id = crypto.randomUUID()
  return { id, sourceSessionId: id, weekday, date: addDays(weekStart(), weekday - 1), name: '', activity: 'Musculation', description: '', exercises: [] }
}

export function programSessions(data: Pick<Snapshot, 'sessions' | 'exercises' | 'sessionExercises' | 'sets'>, programId: string): PlannedSession[] {
  return data.sessions.filter(row => row.programId === programId && !row.retired).sort((a, b) => a.position - b.position).map(session => ({
    id: session.id, sourceSessionId: session.id, weekday: session.weekday, date: addDays(weekStart(), session.weekday - 1), name: session.name,
    activity: session.activity ?? 'Entraînement', description: session.description ?? '',
    exercises: data.sessionExercises.filter(row => row.sessionId === session.id).sort((a, b) => a.position - b.position).map(link => {
      const exercise = data.exercises.find(row => row.id === link.exerciseId)!
      const sets = data.sets.filter(row => row.sessionExerciseId === link.id).sort((a, b) => a.position - b.position)
      return { id: link.id, name: exercise.name, instructions: exercise.notes, sets: sets.length ? sets.map(row => ({ id: row.id, reps: row.reps, durationSeconds: row.durationSeconds, weightKg: row.weightKg })) : [{ id: crypto.randomUUID(), reps: null, durationSeconds: null, weightKg: null }] }
    }),
  }))
}

export function snapshotSessions(template: PlannedSession[], start: string): PlannedSession[] {
  return template.map(session => ({ ...session, id: crypto.randomUUID(), date: addDays(start, session.weekday - 1), exercises: session.exercises.map(ex => ({ ...ex, id: crypto.randomUUID(), sets: ex.sets.map(set => ({ ...set, id: crypto.randomUUID() })) })) }))
}

export function sessionTargets(session: PlannedSession) { return session.exercises.length ? session.exercises.flatMap(ex => ex.sets.map(set => set.id)) : [session.id] }
export function sessionProgress(session: PlannedSession, checks: Records['trainingChecks'][]) {
  const targets = sessionTargets(session)
  const ids = new Set(checks.filter(row => row.occurrenceId === session.id).map(row => row.targetId))
  const done = targets.filter(id => ids.has(id)).length
  return { done, total: targets.length, status: done === targets.length ? 'completed' : done > 0 ? 'partial' : 'planned' } as const
}
export function weekProgress(week: Records['weeks'] | undefined, checks: Records['trainingChecks'][]) {
  const sessions = week?.snapshot ?? []
  return { done: sessions.filter(session => sessionProgress(session, checks).status === 'completed').length, total: sessions.length }
}
