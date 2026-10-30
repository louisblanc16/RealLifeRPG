import type { Transaction } from 'dexie'
import { schemas, type Snapshot } from '../domain/models'
import { entityMeta, programSessions, sessionTargets, snapshotSessions } from '../domain/training'

export async function migrateV2(tx: Transaction) {
  for (const table of ['programs', 'sessions', 'statisticDefinitions', 'weeks'] as const) {
    await tx.table(table).toCollection().modify(row => { Object.assign(row, schemas[table].parse(row)) })
  }
  const data = Object.fromEntries(await Promise.all(['programs', 'sessions', 'exercises', 'sessionExercises', 'sets', 'weeks', 'validations'].map(async name => [name, await tx.table(name).toArray()]))) as Pick<Snapshot, 'programs' | 'sessions' | 'exercises' | 'sessionExercises' | 'sets' | 'weeks' | 'validations'>
  for (const week of data.weeks) {
    if (!week.programId || week.snapshot.length) continue
    const template = programSessions(data, week.programId)
    const snapshot = snapshotSessions(template, week.startDate)
    await tx.table('weeks').update(week.id, { snapshot, programName: data.programs.find(p => p.id === week.programId)?.name ?? 'Programme archivé' })
    for (const legacy of data.validations.filter(row => row.weekId === week.id && row.sourceType === 'session')) {
      const occurrence = snapshot.find(s => s.sourceSessionId === legacy.sourceId)
      if (occurrence) for (const targetId of sessionTargets(occurrence)) {
        const existing = await tx.table('trainingChecks').where('[weekId+targetId]').equals([week.id, targetId]).first()
        if (!existing) await tx.table('trainingChecks').add({ ...entityMeta(), weekId: week.id, occurrenceId: occurrence.id, targetId, checkedAt: legacy.completedAt })
      }
    }
  }
  // Preserve imported v1 data even if multiple programs were active.
  const active = data.programs.filter(p => p.active).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  for (const program of active.slice(1)) await tx.table('programs').update(program.id, { active: false })
}
