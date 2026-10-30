import { db } from './db'
import { readSnapshot } from './repository'
import { ensureCalendar } from './trainingRepository'
import { schemas, type Habit, type Records } from '../domain/models'
import { addDays, localDate, weekEditable, weekStart } from '../domain/dates'
import { entityMeta } from '../domain/training'
import { calculateProgression } from '../domain/progression'
import { difficulty, MAX_COMMITMENTS, type Difficulty } from '../domain/rpgConfig'
import { calculateWeekXp, challengeEvidence, earnedXp, goalKey, type DesiredReward } from '../domain/xp'

export type ChallengeInput = { id?: string; expectedUpdatedAt?: string; name: string; description: string; difficulty: Difficulty; type: 'free' | 'measurable'; statisticId: string | null; comparator: Records['challenges']['comparator']; target: number | null }
export type HabitInput = { id?: string; expectedUpdatedAt?: string; name: string; description: string; difficulty: Difficulty; requiredDays: number[]; active: boolean; calories: number; objectives: string[] }

/** Injectable database keeps critical persistence checks away from personal data. */
export function createRpgService(database = db, prepare: () => Promise<void> = async () => {}) {
  async function ensureWeek(start: string) {
    const existing = await database.weeks.where('startDate').equals(start).first()
    if (existing) return existing
    const week = schemas.weeks.parse({ ...entityMeta(), startDate: start, programId: null, programName: 'Sans programme', notes: '', snapshot: [] })
    await database.weeks.add(week)
    return week
  }
  const cloneHabit = (habit: Habit) => ({ ...habit, id: crypto.randomUUID() })
  async function captureHabits() {
    const versions = (await database.habitSchedules.toArray()).sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart))
    const known = new Set((await database.weeks.toArray()).map(week => week.startDate))
    if (versions.length) for (let start = versions[0].effectiveStart; start <= weekStart(); start = addDays(start, 7)) if (!known.has(start)) { await ensureWeek(start); known.add(start) }
    for (const week of await database.weeks.toArray()) if (!week.habitsCaptured) {
      const revision = versions.filter(v => v.effectiveStart <= week.startDate).at(-1)
      await database.weeks.update(week.id, { habitsCaptured: true, commitmentSnapshot: revision?.commitments.map(cloneHabit) ?? [], dietSnapshot: revision?.diet ? cloneHabit(revision.diet) : null })
    }
  }
  function templateHabit(row: Records['commitments'] | Records['dietGoals']): Habit {
    return { id: crypto.randomUUID(), sourceId: row.id, name: row.name, description: row.description, difficulty: row.difficulty, requiredDays: row.requiredDays, calories: 'target' in row ? row.target : null, objectives: 'objectives' in row ? row.objectives : [] }
  }
  async function saveHabitSchedule(effectiveStart = addDays(weekStart(), 7)) {
    const current = await database.habitSchedules.where('effectiveStart').equals(effectiveStart).first()
    const commitments = (await database.commitments.toArray()).filter(row => row.active && !row.deletedAt).sort((a,b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)).slice(0, MAX_COMMITMENTS).map(templateHabit)
    const diet = (await database.dietGoals.toArray()).filter(row => row.active && !row.deletedAt).sort((a,b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    await database.habitSchedules.put({ ...(current ?? entityMeta()), updatedAt: new Date().toISOString(), effectiveStart, commitments, diet: diet ? templateHabit(diet) : null })
  }

  async function reconcile(now = new Date(), affectedStatisticId?: string) {
    return database.transaction('rw', database.tables, async () => {
      if (await database.habitSchedules.count() === 0 && ((await database.commitments.toArray()).some(row => row.active && !row.deletedAt) || (await database.dietGoals.toArray()).some(row => row.active && !row.deletedAt))) await saveHabitSchedule(weekStart(now))
      const knownWeeks = new Set((await database.weeks.toArray()).map(week => week.startDate))
      for (const achievement of await database.achievements.toArray()) {
        const start = achievement.awardedWeek ?? weekStart(new Date(achievement.achievedAt))
        if (!knownWeeks.has(start)) { await ensureWeek(start); knownWeeks.add(start) }
      }
      await captureHabits()
      let data = await readSnapshot(database)
      for (const challenge of data.challenges) {
        if (challenge.status === 'archived' || data.achievements.some(row => row.challengeId === challenge.id) || (affectedStatisticId && challenge.statisticId !== affectedStatisticId)) continue
        const status = challengeEvidence(challenge, data.measurements, now) ? 'ready' : 'active'
        if (challenge.status !== status) await database.challenges.update(challenge.id, { status })
      }
      const before = new Map(data.xpRewards.map(row => [row.sourceKey, row]))
      const expectedKeys = new Set<string>()
      async function upsert(reward: DesiredReward) {
        expectedKeys.add(reward.sourceKey)
        const existing = before.get(reward.sourceKey)
        const values = { ...reward, managed: true, active: true, revokedAt: null }
        if (existing && Object.entries(values).every(([key,value]) => existing[key as keyof typeof existing] === value)) return
        await database.xpRewards.put({ ...(existing ?? entityMeta()), ...values, updatedAt: now.toISOString() })
      }
      const frozen = new Set(data.weeks.filter(w => w.finalizedAt).map(w => w.startDate))
      for (const week of data.weeks) {
        if (week.finalizedAt) continue
        const result = calculateWeekXp(data, week, now)
        const locked = !weekEditable(week.startDate, now)
        for (const reward of result.rewards) await upsert(reward)
        if (result.bonusXp > 0) {
          const key = `bonus:${week.id}`
          await upsert({ sourceKey: key, sourceType: 'weeklyBonus', sourceId: week.id, amount: result.bonusXp, weekStart: week.startDate, awardedAt: locked ? new Date(`${addDays(week.startDate, 14)}T00:00:00`).toISOString() : before.get(key)?.awardedAt ?? now.toISOString(), provisional: !locked, label: `Bonus hebdomadaire · ${result.successfulPercent} %` })
        }
        if (locked) await database.weeks.update(week.id, { finalizedAt: new Date(`${addDays(week.startDate, 14)}T00:00:00`).toISOString(), finalBaseXp: result.baseXp, finalBonusXp: result.bonusXp, finalBonusPercent: result.successfulPercent })
      }
      for (const reward of data.xpRewards) if (reward.managed && reward.active && !frozen.has(reward.weekStart ?? '') && !expectedKeys.has(reward.sourceKey)) await database.xpRewards.update(reward.id, { active: false, revokedAt: now.toISOString(), updatedAt: now.toISOString() })
      data = await readSnapshot(database)
      const totalXp = earnedXp(data.xpRewards)
      if (!Number.isSafeInteger(totalXp)) throw new Error('Le total d’XP dépasse la limite de calcul exacte.')
      const profile = data.progression[0], view = calculateProgression(totalXp)
      if (profile && (profile.totalXp !== totalXp || profile.level !== view.level || profile.title !== view.title || profile.rank !== view.rank.title)) await database.progression.update(profile.id, { totalXp, level: view.level, title: view.title, rank: view.rank.title, updatedAt: now.toISOString() })
      return data.challenges.filter(c => c.status === 'ready' && (!affectedStatisticId || c.statisticId === affectedStatisticId)).map(c => c.name)
    })
  }

  async function saveChallenge(input: ChallengeInput) {
    await prepare()
    return database.transaction('rw', database.tables, async () => {
      const existing = input.id ? await database.challenges.get(input.id) : undefined
      if (input.id && (!existing || existing.updatedAt !== input.expectedUpdatedAt)) throw new Error('Le défi a changé. Rouvrez son éditeur.')
      if (existing && await database.achievements.where('challengeId').equals(existing.id).first()) throw new Error('Un défi accompli est conservé dans l’historique. Vous pouvez l’archiver.')
      const challenge = schemas.challenges.parse({ ...(existing ?? entityMeta()), name: input.name, description: input.description, difficulty: input.difficulty, rewardXp: difficulty(input.difficulty).challengeXp, type: input.type, statisticId: input.type === 'measurable' ? input.statisticId : null, comparator: input.comparator, target: input.type === 'measurable' ? input.target : null, targetDate: existing?.targetDate ?? null, status: 'active', updatedAt: new Date().toISOString() })
      if (challenge.type === 'measurable') {
        if (!challenge.statisticId || challenge.target === null || !await database.statisticDefinitions.get(challenge.statisticId)) throw new Error('Choisissez une statistique précise et une valeur cible.')
        const key = goalKey(challenge)!
        if (await database.achievements.where('goalKey').equals(key).first()) throw new Error('Cet objectif exact a déjà été récompensé, y compris dans vos archives.')
      }
      await database.challenges.put(challenge)
      await reconcile()
      return challenge.id
    })
  }
  async function confirmChallenge(id: string, explicitConsent: boolean) {
    if (!explicitConsent) throw new Error('La confirmation explicite de réalisation est requise.')
    await prepare()
    await database.transaction('rw', database.tables, async () => {
      const challenge = await database.challenges.get(id)
      if (!challenge || challenge.status === 'archived') throw new Error('Ce défi n’est pas disponible.')
      if (await database.achievements.where('challengeId').equals(id).first()) throw new Error('Ce défi a déjà reçu sa récompense.')
      const key = goalKey(challenge)
      if (key && await database.achievements.where('goalKey').equals(key).first()) throw new Error('Cet objectif a déjà été récompensé.')
      const evidence = challengeEvidence(challenge, await database.measurements.toArray())
      if (challenge.type === 'measurable' && !evidence) throw new Error('Aucune mesure admissible n’atteint actuellement cet objectif.')
      const now = new Date().toISOString(), week = await ensureWeek(weekStart())
      await database.achievements.add({ ...entityMeta(), challengeId: id, achievedAt: now, goalKey: key, nameSnapshot: challenge.name, difficulty: challenge.difficulty === 'epic' ? 'hard' : challenge.difficulty, type: challenge.type, awardedWeek: week.startDate, evidenceValue: evidence?.value ?? null, evidenceDate: evidence?.measuredAt ?? null })
      await database.challenges.update(id, { status: 'completed', updatedAt: now })
      await reconcile()
    })
  }
  async function archiveChallenge(id: string, archived: boolean) {
    await prepare()
    await database.transaction('rw', database.tables, async () => {
      if (!await database.challenges.get(id)) throw new Error('Défi introuvable.')
      const completed = !!await database.achievements.where('challengeId').equals(id).first()
      await database.challenges.update(id, { status: archived ? 'archived' : completed ? 'completed' : 'active', updatedAt: new Date().toISOString() })
      await reconcile()
    })
  }

  async function saveHabit(kind: 'commitment' | 'diet', input: HabitInput) {
    await prepare()
    await database.transaction('rw', database.tables, async () => {
      const table = kind === 'commitment' ? database.commitments : database.dietGoals
      const existing = input.id ? await table.get(input.id) : undefined
      if (input.id && (!existing || existing.updatedAt !== input.expectedUpdatedAt || existing.deletedAt)) throw new Error('Cet objectif a changé. Rouvrez son éditeur.')
      const now = new Date().toISOString()
      if (kind === 'commitment') {
        const active = (await database.commitments.toArray()).filter(c => c.active && !c.deletedAt && c.id !== input.id)
        if (input.active && active.length >= MAX_COMMITMENTS) throw new Error('Trois engagements actifs maximum. Désactivez-en un pour préparer la suite.')
      } else if (input.active) {
        if (!(input.calories > 0)) throw new Error('Indiquez un objectif quotidien de calories positif.')
        for (const other of await database.dietGoals.toArray()) if (other.id !== input.id && other.active) await database.dietGoals.update(other.id, { active: false, updatedAt: now })
      }
      const common = { ...(existing ?? entityMeta()), name: input.name, description: input.description, difficulty: input.difficulty, requiredDays: [...input.requiredDays].sort(), active: input.active, updatedAt: now }
      const row = kind === 'commitment' ? schemas.commitments.parse({ ...common, daysPerWeek: input.requiredDays.length }) : schemas.dietGoals.parse({ ...common, target: input.calories, unit: 'kcal', objectives: input.objectives })
      if (kind === 'commitment') await database.commitments.put(row as Records['commitments'])
      else await database.dietGoals.put(row as Records['dietGoals'])
      await saveHabitSchedule()
      const week = await ensureWeek(weekStart())
      await captureHabits()
      const current = (await database.weeks.get(week.id))!
      // Only the first configuration/activation can fill unused current-week slots.
      // Removing/recreating templates never releases an already allocated slot.
      if ((!existing || !existing.active) && input.active && !current.finalizedAt) {
        if (kind === 'commitment' && current.commitmentSnapshot.length < MAX_COMMITMENTS && !current.commitmentSnapshot.some(h => h.sourceId === row.id)) await database.weeks.update(current.id, { commitmentSnapshot: [...current.commitmentSnapshot, templateHabit(row)], updatedAt: now })
        if (kind === 'diet' && !current.dietSnapshot) await database.weeks.update(current.id, { dietSnapshot: templateHabit(row), updatedAt: now })
      }
      await reconcile()
    })
  }
  async function archiveHabit(kind: 'commitment' | 'diet', id: string) {
    await prepare()
    await database.transaction('rw', database.tables, async () => {
      const table = kind === 'commitment' ? database.commitments : database.dietGoals
      await table.update(id, { active: false, deletedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
      await saveHabitSchedule()
      await reconcile()
    })
  }
  async function setDailyState(weekId: string, habitId: string, date: string, state: 'respected' | 'failed' | null) {
    await prepare()
    await database.transaction('rw', database.tables, async () => {
      const week = await database.weeks.get(weekId)
      if (!week || week.finalizedAt || !weekEditable(week.startDate)) throw new Error('Cette semaine est verrouillée.')
      const habit = [...week.commitmentSnapshot, ...(week.dietSnapshot ? [week.dietSnapshot] : [])].find(h => h.id === habitId)
      if (!habit || !habit.requiredDays.some(day => addDays(week.startDate, day - 1) === date)) throw new Error('Cette date n’est pas un jour requis.')
      if (date > localDate(new Date())) throw new Error('Un jour futur ne peut pas être validé.')
      const existing = await database.dailyChecks.where('[weekId+habitId+date]').equals([weekId, habitId, date]).first()
      if (state) await database.dailyChecks.put(schemas.dailyChecks.parse({ ...(existing ?? entityMeta()), weekId, habitId, date, state, updatedAt: new Date().toISOString() }))
      else if (existing) await database.dailyChecks.delete(existing.id)
      await reconcile()
    })
  }
  async function saveFavorites(ids: string[]) {
    await database.transaction('rw', [database.settings, database.statisticDefinitions], async () => {
      const settings = await database.settings.toCollection().first()
      if (!settings || ids.length > 6 || new Set(ids).size !== ids.length) throw new Error('Choisissez jusqu’à six statistiques distinctes.')
      for (const id of ids) if (!await database.statisticDefinitions.get(id)) throw new Error('Statistique introuvable.')
      await database.settings.update(settings.id, { favoriteStatisticIds: ids, updatedAt: new Date().toISOString() })
    })
  }
  return { reconcile, saveChallenge, confirmChallenge, archiveChallenge, saveHabit, archiveHabit, setDailyState, saveFavorites }
}

export const rpgService = createRpgService(db, ensureCalendar)
export const reconcileRpg = rpgService.reconcile
export async function refreshGame() { await ensureCalendar(); await reconcileRpg() }
