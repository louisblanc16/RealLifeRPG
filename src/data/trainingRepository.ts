import { db } from './db'
import { readSnapshot } from './repository'
import { plannedSessionSchema, schemas, type PlannedSession, type Records, type Snapshot } from '../domain/models'
import { addDays, localDate, weekEditable, weekStart } from '../domain/dates'
import { entityMeta, programSessions, sessionTargets, snapshotSessions } from '../domain/training'
import { reconcileRpg } from './rpgRepository'

function validatePlan(sessions: PlannedSession[]) {
  const ids = new Set<string>()
  const unique = (id: string) => { if (ids.has(id)) throw new Error('Identifiant de séance ou de série dupliqué.'); ids.add(id) }
  for (const session of sessions) {
    plannedSessionSchema.parse(session); unique(session.id)
    for (const exercise of session.exercises) {
      unique(exercise.id)
      for (const set of exercise.sets) {
        unique(set.id)
        if ((set.reps === null) === (set.durationSeconds === null) || (set.reps ?? set.durationSeconds ?? 0) <= 0) throw new Error('Chaque série doit avoir des répétitions ou une durée positive.')
      }
    }
  }
}

async function writeSchedule(data: Snapshot, program: Records['programs'] | null) {
  const start = weekStart()
  const effectiveStart = data.weeks.some(w => w.startDate === start) ? addDays(start, 7) : start
  const existing = data.scheduleVersions.find(v => v.effectiveStart === effectiveStart)
  await db.scheduleVersions.put({ ...(existing ?? entityMeta()), updatedAt: new Date().toISOString(), effectiveStart, programId: program?.id ?? null, programName: program?.name ?? 'Repos', sessions: program ? programSessions(data, program.id) : [] })
}

async function materializeWeeks() {
  const versions = (await db.scheduleVersions.toArray()).sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart))
  if (!versions.length) return
  const end = weekStart()
  const existing = new Set((await db.weeks.toArray()).map(w => w.startDate))
  for (let start = versions[0].effectiveStart; start <= end; start = addDays(start, 7)) {
    if (existing.has(start)) continue
    const revision = versions.filter(v => v.effectiveStart <= start).at(-1)
    if (!revision) continue
    await db.weeks.add(schemas.weeks.parse({ ...entityMeta(), startDate: start, programId: revision.programId, programName: revision.programName, notes: '', snapshot: snapshotSessions(revision.sessions, start) }))
  }
}

export async function ensureCalendar() {
  await db.transaction('rw', db.tables, async () => {
    const data = await readSnapshot()
    const active = data.programs.find(p => p.active && !p.deletedAt)
    if (!data.scheduleVersions.length && active) await writeSchedule(data, active)
    await materializeWeeks()
  })
}

export async function saveProgram(input: { id?: string; expectedUpdatedAt?: string; name: string; description: string; sessions: PlannedSession[] }) {
  validatePlan(input.sessions)
  await db.transaction('rw', db.tables, async () => {
    await materializeWeeks()
    const data = await readSnapshot()
    const existing = input.id ? data.programs.find(p => p.id === input.id && !p.deletedAt) : undefined
    if (input.id && (!existing || existing.updatedAt !== input.expectedUpdatedAt)) throw new Error('Le programme a changé. Rouvrez son éditeur avant de continuer.')
    const now = new Date().toISOString()
    const program = schemas.programs.parse({ ...(existing ?? entityMeta()), name: input.name, description: input.description, active: existing?.active ?? !data.programs.some(p => p.active && !p.deletedAt), updatedAt: now })
    await db.programs.put(program)
    const oldSessions = data.sessions.filter(s => s.programId === program.id)
    for (const old of oldSessions) {
      if (!input.sessions.some(s => s.id === old.id)) await db.sessions.update(old.id, { retired: true, updatedAt: now })
      const links = data.sessionExercises.filter(ex => ex.sessionId === old.id)
      for (const link of links) await db.sets.where('sessionExerciseId').equals(link.id).delete()
      await db.sessionExercises.where('sessionId').equals(old.id).delete()
    }
    for (const [position, session] of input.sessions.entries()) {
      const old = oldSessions.find(s => s.id === session.id)
      if (!old && data.sessions.some(s => s.id === session.id)) throw new Error('La séance appartient déjà à un autre programme.')
      await db.sessions.put({ ...(old ?? entityMeta()), id: session.id, programId: program.id, name: session.name.trim(), weekday: session.weekday, activity: session.activity.trim(), description: session.description, position, retired: false, updatedAt: now })
      for (const [exPosition, exercise] of session.exercises.entries()) {
        const previousLink = data.sessionExercises.find(link => link.id === exercise.id)
        const previousExercise = previousLink ? data.exercises.find(ex => ex.id === previousLink.exerciseId) : undefined
        const definition = { ...(previousExercise ?? entityMeta()), name: exercise.name.trim(), category: session.activity.trim(), notes: exercise.instructions, updatedAt: now }
        await db.exercises.put(definition)
        await db.sessionExercises.put({ ...entityMeta(), id: exercise.id, sessionId: session.id, exerciseId: definition.id, position: exPosition })
        for (const [setPosition, set] of exercise.sets.entries()) await db.sets.put({ ...entityMeta(), ...set, sessionExerciseId: exercise.id, position: setPosition })
      }
    }
    if (program.active) await writeSchedule(await readSnapshot(), program)
    await materializeWeeks()
  })
}

export async function selectProgram(id: string | null) {
  await db.transaction('rw', db.tables, async () => {
    await materializeWeeks()
    const data = await readSnapshot()
    const chosen = id ? data.programs.find(p => p.id === id && !p.deletedAt) : null
    if (id && !chosen) throw new Error('Programme introuvable.')
    for (const program of data.programs) if (program.active !== (program.id === id)) await db.programs.update(program.id, { active: program.id === id, updatedAt: new Date().toISOString() })
    await writeSchedule(data, chosen ?? null)
    await materializeWeeks()
  })
}

export async function deleteProgram(id: string) {
  await db.transaction('rw', db.tables, async () => {
    await materializeWeeks()
    const data = await readSnapshot()
    const program = data.programs.find(p => p.id === id)
    if (!program) throw new Error('Programme introuvable.')
    await db.programs.update(id, { active: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    if (program.active) await writeSchedule(data, null)
    // Soft deletion keeps legacy references, schedule versions and snapshots intact.
  })
}

export async function applyProgramToCurrentWeek(id: string) {
  await db.transaction('rw', db.tables, async () => {
    const data = await readSnapshot()
    const program = data.programs.find(p => p.id === id && !p.deletedAt)
    if (!program) throw new Error('Programme introuvable.')
    const week = data.weeks.find(w => w.startDate === weekStart())
    if (week?.finalizedAt) throw new Error('Cette semaine est définitivement verrouillée.')
    if (week && (data.trainingChecks.some(check => check.weekId === week.id) || data.trainingEvents.some(event => event.weekId === week.id))) throw new Error('Cette semaine a déjà été commencée. Modifiez ses séances individuellement pour préserver vos validations.')
    const snapshot = snapshotSessions(programSessions(data, id), weekStart())
    await db.weeks.put(schemas.weeks.parse({ ...(week ?? entityMeta()), startDate: weekStart(), programId: id, programName: program.name, notes: week?.notes ?? '', snapshot, updatedAt: new Date().toISOString() }))
    await reconcileRpg()
  })
}

export async function saveWeekSession(weekId: string, session: PlannedSession, expectedUpdatedAt: string) {
  validatePlan([session])
  await db.transaction('rw', db.tables, async () => {
    const week = await db.weeks.get(weekId)
    if (!week || week.finalizedAt || !weekEditable(week.startDate)) throw new Error('Cette semaine est verrouillée.')
    if (week.updatedAt !== expectedUpdatedAt) throw new Error('La semaine a changé. Rouvrez la séance.')
    const old = week.snapshot.find(s => s.id === session.id)
    if (!old || old.date !== session.date || old.weekday !== session.weekday || old.sourceSessionId !== session.sourceSessionId) throw new Error('La date réelle et l’identité de la séance doivent être conservées.')
    const targets = new Set(sessionTargets(session))
    const checks = await db.trainingChecks.where('occurrenceId').equals(session.id).toArray()
    for (const check of checks) if (!targets.has(check.targetId)) {
      await db.trainingChecks.delete(check.id)
      await db.trainingEvents.add({ ...entityMeta(), weekId, occurrenceId: session.id, targetId: check.targetId, checked: false, scheduledDate: old.date, recordedAt: new Date().toISOString() })
    }
    await db.weeks.update(weekId, { snapshot: week.snapshot.map(s => s.id === session.id ? session : s), updatedAt: new Date().toISOString() })
    await reconcileRpg()
  })
}

export async function setTrainingCheck(weekId: string, occurrenceId: string, targetId: string, checked: boolean) {
  await db.transaction('rw', db.tables, async () => {
    const week = await db.weeks.get(weekId)
    if (!week || week.finalizedAt || !weekEditable(week.startDate)) throw new Error('L’échéance de modification de cette semaine est dépassée.')
    const session = week.snapshot.find(s => s.id === occurrenceId)
    if (!session || !sessionTargets(session).includes(targetId)) throw new Error('Cette série n’existe plus. Rouvrez la séance.')
    if (session.date > localDate(new Date())) throw new Error('Cette séance est prévue pour une date future.')
    const existing = await db.trainingChecks.where('[weekId+targetId]').equals([weekId, targetId]).first()
    if (checked === !!existing) return
    if (checked) await db.trainingChecks.add({ ...entityMeta(), weekId, occurrenceId, targetId, checkedAt: new Date().toISOString() })
    else if (existing) await db.trainingChecks.delete(existing.id)
    await db.trainingEvents.add({ ...entityMeta(), weekId, occurrenceId, targetId, checked, scheduledDate: session.date, recordedAt: new Date().toISOString() })
    await reconcileRpg()
  })
}
