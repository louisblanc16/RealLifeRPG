import { db } from './db'
import { schemas, tableNames, type Snapshot, type TableName } from '../domain/models'

export async function readSnapshot(database = db): Promise<Snapshot> {
  return database.transaction('r', database.tables, async () => Object.fromEntries(
    await Promise.all(tableNames.map(async table => [table, await database.table(table).toArray()])),
  ) as Snapshot)
}

export async function saveDisplayName(value: string) {
  const displayName = schemas.settings.shape.displayName.parse(value)
  await db.transaction('rw', db.settings, async () => {
    const settings = await db.settings.toCollection().first()
    if (!settings) throw new Error('Profil introuvable.')
    await db.settings.update(settings.id, { displayName, updatedAt: new Date().toISOString() })
  })
}

export async function saveAppearance(values: Pick<Snapshot['settings'][number], 'theme' | 'accent'>) {
  const appearance = schemas.settings.pick({ theme: true, accent: true }).parse(values)
  await db.transaction('rw', db.settings, async () => {
    const profile = await db.settings.toCollection().first()
    if (!profile) throw new Error('Profil introuvable.')
    await db.settings.update(profile.id, { ...appearance, updatedAt: new Date().toISOString() })
  })
}

export const tableLabels: Record<TableName, string> = {
  settings: 'Profil', programs: 'Programmes', sessions: 'Séances', exercises: 'Exercices',
  sessionExercises: 'Exercices planifiés', sets: 'Séries', weeks: 'Semaines', validations: 'Validations',
  statisticDefinitions: 'Statistiques', measurements: 'Mesures', challenges: 'Défis', achievements: 'Réalisations',
  commitments: 'Engagements', dietGoals: 'Objectifs diète', xpRewards: 'Récompenses XP', progression: 'Progression RPG',
  scheduleVersions: 'Versions de planning', trainingChecks: 'Séries validées', trainingEvents: 'Événements sportifs',
  habitSchedules: 'Versions des engagements', dailyChecks: 'Validations quotidiennes',
}
