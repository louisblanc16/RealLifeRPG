import Dexie, { type Table } from 'dexie'
import { PROFILE_ID, PROGRESSION_ID, schemas, tableNames, type Records, type TableName } from '../domain/models'
import { migrateV2 } from './migrations'
import { entityMeta } from '../domain/training'
import { presets } from '../domain/statistics'
import { upgradeRpgData } from '../domain/rpgMigration'

export function createDatabase(name = 'real-life-rpg') {
  const db = new Dexie(name) as Dexie & { [K in TableName]: Table<Records[K], string> }

  // Never edit a released schema in place: append version(n).stores(...).upgrade(...).
  db.version(1).stores({
    settings: 'id',
    programs: 'id',
    sessions: 'id, programId, [programId+weekday]',
    exercises: 'id, name',
    sessionExercises: 'id, sessionId, exerciseId, [sessionId+position]',
    sets: 'id, sessionExerciseId, [sessionExerciseId+position]',
    weeks: 'id, &startDate, programId',
    validations: 'id, weekId, [sourceType+sourceId], completedAt',
    statisticDefinitions: 'id, kind',
    measurements: 'id, definitionId, [definitionId+measuredAt]',
    challenges: 'id, status, targetDate',
    achievements: 'id, &challengeId, achievedAt',
    commitments: 'id',
    dietGoals: 'id',
    xpRewards: 'id, &sourceKey, [sourceType+sourceId], awardedAt',
    progression: 'id, &userId',
  })

  db.version(2).stores({
    scheduleVersions: 'id, &effectiveStart, programId',
    trainingChecks: 'id, weekId, occurrenceId, &[weekId+targetId]',
    trainingEvents: 'id, weekId, occurrenceId, recordedAt, [weekId+occurrenceId]',
  }).upgrade(migrateV2)
  db.version(3).stores({ habitSchedules: 'id, &effectiveStart', dailyChecks: 'id, weekId, habitId, &[weekId+habitId+date]', achievements: 'id, &challengeId, achievedAt, &goalKey' }).upgrade(async tx => {
    const raw = Object.fromEntries(await Promise.all(tableNames.map(async name => [name, await tx.table(name).toArray()])))
    // v2 had a count of required days, but no particular weekdays.
    for (const row of raw.commitments) if (!row.requiredDays) row.requiredDays = Array.from({ length: row.daysPerWeek }, (_, index) => index + 1)
    const normalized = upgradeRpgData(raw as unknown as import('../domain/models').Snapshot)
    // Canonical keys may exchange places; replace atomically with identical IDs.
    await tx.table('xpRewards').clear()
    for (const name of ['settings', 'weeks', 'challenges', 'achievements', 'commitments', 'dietGoals', 'xpRewards'] as const) await tx.table(name).bulkPut(normalized[name])
  })
  db.version(4).stores({ settings: 'id' }).upgrade(async tx => {
    // Preference defaults only; progression, snapshots and rewards stay untouched.
    for (const row of await tx.table('settings').toArray()) await tx.table('settings').put(schemas.settings.parse(row))
  })
  return db
}

export const db = createDatabase()
export const lifecycleSource = crypto.randomUUID()
export const RESET_PHRASE = 'RÉINITIALISER'

export async function initializeDatabase(database = db) {
  await database.open()
  await database.transaction('rw', [database.settings, database.progression, database.statisticDefinitions], async () => {
    const now = new Date().toISOString()
    if (await database.settings.count() === 0) {
      await database.settings.add(schemas.settings.parse({ id: PROFILE_ID, displayName: 'Aventurier', weightUnit: 'kg', weekStartsOn: 1, createdAt: now, updatedAt: now }))
    }
    for (const preset of presets) {
      const existing = await database.statisticDefinitions.toArray()
      if (!existing.some(row => row.presetKey === preset.key || row.name === preset.name || (preset.kind === 'weight' && row.kind === 'weight'))) {
        const { key, ...definition } = preset
        await database.statisticDefinitions.add({ ...entityMeta(), ...definition, presetKey: key })
      }
    }
    if (await database.progression.count() === 0) {
      const settings = await database.settings.toCollection().first()
      if (!settings) throw new Error('Profil introuvable.')
      await database.progression.add({ id: PROGRESSION_ID, userId: settings.id, level: 1, totalXp: 0, title: 'Le premier pas', rank: null, createdAt: now, updatedAt: now })
    }
  })
}

/** Clear every store and seed a fresh profile in a single rollback-safe transaction. */
export async function resetAllData(confirmation: { acknowledged: boolean; phrase: string }, database = db) {
  if (confirmation.acknowledged !== true || confirmation.phrase.normalize('NFC') !== RESET_PHRASE) throw new Error('Les deux confirmations et le mot RÉINITIALISER exact sont requis.')
  await database.transaction('rw', database.tables, async () => {
    for (const table of database.tables) await table.clear()
    await initializeDatabase(database)
  })
  // Other open tabs discard their old forms and in-memory state too.
  if (database === db && typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel('real-life-rpg-lifecycle')
      channel.postMessage({ type: 'reset', source: lifecycleSource })
      channel.close()
    } catch { /* The committed reset must still reload if tab messaging is unavailable. */ }
  }
}
