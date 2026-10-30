import { db } from './db'
import { schemas, type Records } from '../domain/models'
import { entityMeta } from '../domain/training'
import { reconcileRpg } from './rpgRepository'

export async function saveStatistic(input: Records['statisticDefinitions'], expectedUpdatedAt?: string) {
  const definition = schemas.statisticDefinitions.parse(input)
  await db.transaction('rw', db.tables, async () => {
    const old = await db.statisticDefinitions.get(definition.id)
    if (old && old.updatedAt !== expectedUpdatedAt) throw new Error('Cet indicateur a changé. Rouvrez son éditeur.')
    if (old?.kind === 'weight' && (definition.unit !== 'kg' || definition.direction !== 'neutral' || definition.valueType !== 'decimal')) throw new Error('Le poids est suivi en kg, sans jugement automatique.')
    const measures = await db.measurements.where('definitionId').equals(definition.id).toArray()
    if (definition.valueType !== 'decimal' && measures.some(m => !Number.isInteger(m.value))) throw new Error('Des mesures décimales existent : conservez un type décimal.')
    await db.statisticDefinitions.put({ ...definition, updatedAt: new Date().toISOString() })
    await reconcileRpg(new Date(), definition.id)
  })
}

export async function deleteStatistic(id: string) {
  await db.transaction('rw', db.tables, async () => {
    const definition = await db.statisticDefinitions.get(id)
    if (!definition || definition.presetKey || definition.kind === 'weight') throw new Error('Les indicateurs initiaux peuvent être personnalisés mais pas supprimés.')
    if ((await db.challenges.toArray()).some(c => c.statisticId === id)) throw new Error('Cette statistique est liée à un défi. Son identité et son historique doivent être conservés.')
    await db.measurements.where('definitionId').equals(id).delete()
    await db.statisticDefinitions.delete(id)
    const settings = await db.settings.toCollection().first()
    if (settings) await db.settings.update(settings.id, { favoriteStatisticIds: settings.favoriteStatisticIds.filter(value => value !== id) })
    await reconcileRpg()
  })
}

export async function saveMeasurement(input: { id?: string; expectedUpdatedAt?: string; definitionId: string; value: number; measuredAt: string; notes: string }) {
  return db.transaction('rw', db.tables, async () => {
    const definition = await db.statisticDefinitions.get(input.definitionId)
    if (!definition) throw new Error('Indicateur introuvable.')
    if (!Number.isFinite(input.value) || (definition.kind !== 'custom' && input.value < 0) || (definition.kind === 'weight' && input.value <= 0)) throw new Error('Saisissez une valeur valide pour cet indicateur.')
    if (definition.valueType !== 'decimal' && !Number.isSafeInteger(input.value)) throw new Error('Cet indicateur nécessite un nombre entier.')
    const old = input.id ? await db.measurements.get(input.id) : undefined
    if (input.id && (!old || old.updatedAt !== input.expectedUpdatedAt || old.definitionId !== input.definitionId)) throw new Error('Cette mesure a changé. Rouvrez son éditeur.')
    const measurement = schemas.measurements.parse({ ...(old ?? entityMeta()), definitionId: input.definitionId, value: input.value, measuredAt: input.measuredAt, notes: input.notes, updatedAt: new Date().toISOString() })
    if (new Date(measurement.measuredAt).getTime() > Date.now()) throw new Error('Une mesure ne peut pas être datée dans le futur.')
    await db.measurements.put(measurement)
    return reconcileRpg(new Date(), definition.id)
  })
}

export async function deleteMeasurement(id: string, expectedUpdatedAt: string) {
  await db.transaction('rw', db.tables, async () => {
    const old = await db.measurements.get(id)
    if (!old || old.updatedAt !== expectedUpdatedAt) throw new Error('Cette mesure a changé. Actualisez son historique.')
    await db.measurements.delete(id)
    await reconcileRpg(new Date(), old.definitionId)
  })
}
