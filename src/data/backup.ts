import { z } from 'zod'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { db } from './db'
import { readSnapshot } from './repository'
import { BACKUP_VERSION, SCHEMA_VERSION, snapshotSchema, tableNames, validateRelations, type Snapshot } from '../domain/models'
import { entityMeta, programSessions, sessionTargets, snapshotSessions } from '../domain/training'
import { presets } from '../domain/statistics'
import { initializeDatabase } from './db'
import { ensureCalendar } from './trainingRepository'
import { upgradeRpgData } from '../domain/rpgMigration'
import { refreshGame } from './rpgRepository'

const backupSchema = z.object({
  app: z.literal('REAL_LIFE_RPG'),
  formatVersion: z.literal(BACKUP_VERSION),
  schemaVersion: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(SCHEMA_VERSION)]),
  exportedAt: z.iso.datetime({ offset: true }),
  data: snapshotSchema,
}).strict()

export type Backup = z.infer<typeof backupSchema>

export async function parseBackup(file: File): Promise<Backup> {
  if (file.size > 20 * 1024 * 1024) throw new Error('Le fichier dépasse la limite de 20 Mo.')
  let json: unknown
  try { json = JSON.parse(await file.text()) } catch { throw new Error('Ce fichier ne contient pas un JSON valide.') }
  const result = backupSchema.safeParse(json)
  if (!result.success) throw new Error('Sauvegarde incompatible ou invalide. Un export REAL LIFE RPG au format 1 et schéma 1 à 4 est requis.')
  if (result.data.schemaVersion === 1) {
    const data = result.data.data
    for (const week of data.weeks) if (week.programId && !week.snapshot.length) {
      week.programName = data.programs.find(p => p.id === week.programId)?.name ?? 'Programme archivé'
      week.snapshot = snapshotSessions(programSessions(data, week.programId), week.startDate)
      for (const validation of data.validations.filter(v => v.weekId === week.id && v.sourceType === 'session')) {
        const session = week.snapshot.find(s => s.sourceSessionId === validation.sourceId)
        if (session) for (const targetId of sessionTargets(session)) if (!data.trainingChecks.some(check => check.weekId === week.id && check.targetId === targetId)) data.trainingChecks.push({ ...entityMeta(), weekId: week.id, occurrenceId: session.id, targetId, checkedAt: validation.completedAt })
      }
    }
    const active = data.programs.filter(p => p.active).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    active.slice(1).forEach(program => { program.active = false })
  }
  if (result.data.schemaVersion < 3) result.data.data = upgradeRpgData(result.data.data)
  result.data.schemaVersion = SCHEMA_VERSION
  validateRelations(result.data.data)
  return result.data
}

export async function downloadBackup(data: Snapshot, prefix = 'real-life-rpg'): Promise<boolean> {
  const backup: Backup = { app: 'REAL_LIFE_RPG', formatVersion: BACKUP_VERSION, schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), data }
  const contents = JSON.stringify(backup, null, 2)
  const fileName = `${prefix}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  if (isTauri()) {
    try { return await invoke<boolean>('export_backup', { contents, fileName }) }
    catch (error) { throw new Error(typeof error === 'string' ? error : 'La sauvegarde n’a pas pu être enregistrée.') }
  }
  const blob = new Blob([contents], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return true
}

export async function exportBackup() { return downloadBackup(await readSnapshot()) }

// Stable property order permits meaningful comparison independent of JSON key order.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`
  return JSON.stringify(value)
}

export function mergeSnapshots(current: Snapshot, incoming: Snapshot): Snapshot {
  const merged = {} as Record<string, unknown[]>
  for (const table of tableNames) {
    const records = new Map(current[table].map(row => [row.id, row]))
    for (const row of incoming[table]) {
      const existing = records.get(row.id)
      if (existing && canonical(existing) !== canonical(row)) throw new Error('Import refusé : des données existantes diffèrent. Aucun enregistrement ne sera écrasé.')
      if (!existing) records.set(row.id, row)
    }
    merged[table] = [...records.values()]
  }
  const parsed = snapshotSchema.parse(merged)
  validateRelations(parsed)
  return parsed
}

function isPristine(data: Snapshot) {
  return data.settings.length === 1 && data.settings[0].displayName === 'Aventurier'
    && data.progression.length === 1 && data.progression[0].totalXp === 0
    && data.settings[0].createdAt === data.settings[0].updatedAt
    && data.statisticDefinitions.every(row => row.createdAt === row.updatedAt && presets.some(p => p.key === row.presetKey && p.name === row.name && p.unit === row.unit && p.direction === row.direction && p.valueType === row.valueType))
    && tableNames.filter(name => name !== 'settings' && name !== 'progression' && name !== 'statisticDefinitions').every(name => data[name].length === 0)
}

/** A fresh installation can restore a complete backup, after explicit confirmation. */
export function previewImport(current: Snapshot, incoming: Snapshot) {
  const fresh = isPristine(current)
  if (!fresh) mergeSnapshots(current, incoming)
  return { fresh, count: tableNames.reduce((total, table) => total + incoming[table].length, 0) }
}

export async function importBackup(backup: Backup, expected: Snapshot) {
  // Re-validate at the write boundary; no partial writes, including on quota failures.
  const incoming = snapshotSchema.parse(backup.data)
  validateRelations(incoming)
  await db.transaction('rw', db.tables, async () => {
    const current = await readSnapshot()
    if (canonical(current) !== canonical(expected)) throw new Error('Les données ont changé depuis l’aperçu. Sélectionnez de nouveau le fichier.')
    const fresh = isPristine(current)
    if (fresh) {
      for (const table of tableNames) await db.table(table).clear()
      for (const table of tableNames) await db.table(table).bulkAdd(incoming[table])
    } else {
      mergeSnapshots(current, incoming)
      for (const table of tableNames) {
        const ids = new Set(current[table].map(row => row.id))
        await db.table(table).bulkAdd(incoming[table].filter(row => !ids.has(row.id)))
      }
    }
  })
  await initializeDatabase()
  await ensureCalendar()
  await refreshGame()
}
