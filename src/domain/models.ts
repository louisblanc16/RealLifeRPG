import { z } from 'zod'

export const SCHEMA_VERSION = 4
export const BACKUP_VERSION = 1
export const PROFILE_ID = '00000000-0000-4000-8000-000000000001'
export const PROGRESSION_ID = '00000000-0000-4000-8000-000000000002'
const id = z.uuid()
const timestamp = z.iso.datetime({ offset: true })
const date = z.iso.date()
const name = z.string().trim().min(1).max(120)
const nonnegative = z.number().finite().nonnegative()
const integer = nonnegative.int().max(Number.MAX_SAFE_INTEGER)
const entity = z.object({ id, createdAt: timestamp, updatedAt: timestamp }).strict()
const sourceType = z.enum(['session', 'challenge', 'commitment', 'dietGoal', 'weeklyBonus'])
export const difficultySchema = z.enum(['easy', 'medium', 'hard'])
const requiredDays = z.array(z.number().int().min(1).max(7)).min(1).max(7).refine(days => new Set(days).size === days.length, 'Jours requis dupliqués.')
export const habitSchema = z.object({ id, sourceId: id, name, description: z.string().max(2000), difficulty: difficultySchema, requiredDays, calories: nonnegative.nullable(), objectives: z.array(z.string().min(1).max(200)).max(10) }).strict()
export type Habit = z.infer<typeof habitSchema>

export const plannedSetSchema = z.object({ id, reps: integer.nullable(), durationSeconds: integer.nullable(), weightKg: nonnegative.nullable() }).strict()
export const plannedExerciseSchema = z.object({ id, name, instructions: z.string().max(2000), sets: z.array(plannedSetSchema).min(1).max(100) }).strict()
export const plannedSessionSchema = z.object({
  id, sourceSessionId: id, weekday: z.number().int().min(1).max(7), date,
  name, activity: name, description: z.string().max(2000), exercises: z.array(plannedExerciseSchema).max(100),
}).strict()
export type PlannedSet = z.infer<typeof plannedSetSchema>
export type PlannedExercise = z.infer<typeof plannedExerciseSchema>
export type PlannedSession = z.infer<typeof plannedSessionSchema>

export const schemas = {
  settings: entity.extend({ displayName: name, weightUnit: z.literal('kg'), weekStartsOn: z.literal(1), favoriteStatisticIds: z.array(id).max(6).default([]), theme: z.enum(['dark', 'light', 'system']).default('dark'), accent: z.enum(['violet', 'blue', 'red', 'emerald', 'orange']).default('violet') }),
  programs: entity.extend({ name, description: z.string().max(2000), active: z.boolean(), deletedAt: timestamp.nullable().default(null) }),
  sessions: entity.extend({ programId: id, name, weekday: z.number().int().min(1).max(7), activity: name.default('Entraînement'), description: z.string().max(2000).default(''), position: integer.default(0), retired: z.boolean().default(false) }),
  exercises: entity.extend({ name, category: z.string().max(120), notes: z.string().max(2000) }),
  sessionExercises: entity.extend({ sessionId: id, exerciseId: id, position: integer }),
  sets: entity.extend({ sessionExerciseId: id, position: integer, reps: integer.nullable(), weightKg: nonnegative.nullable(), durationSeconds: integer.nullable() }),
  weeks: entity.extend({ startDate: date.refine(value => new Date(`${value}T12:00:00`).getDay() === 1, 'La semaine doit commencer un lundi.'), programId: id.nullable(), notes: z.string().max(2000), programName: z.string().max(120).default('Sans programme'), snapshot: z.array(plannedSessionSchema).default([]), commitmentSnapshot: z.array(habitSchema).max(3).default([]), dietSnapshot: habitSchema.nullable().default(null), habitsCaptured: z.boolean().default(false), finalizedAt: timestamp.nullable().default(null), finalBaseXp: integer.nullable().default(null), finalBonusXp: integer.nullable().default(null), finalBonusPercent: integer.nullable().default(null) }),
  validations: entity.extend({ weekId: id, sourceType, sourceId: id, completedAt: timestamp }),
  statisticDefinitions: entity.extend({ name, unit: z.string().max(30), kind: z.enum(['weight', 'performance', 'custom']), valueType: z.enum(['decimal', 'integer', 'duration']).default('decimal'), direction: z.enum(['higher', 'lower', 'neutral']).default('neutral'), presetKey: z.string().nullable().default(null) }),
  measurements: entity.extend({ definitionId: id, value: z.number().finite(), measuredAt: timestamp, notes: z.string().max(2000) }),
  challenges: entity.extend({ name, description: z.string().max(2000), difficulty: z.enum(['easy', 'medium', 'hard', 'epic']), status: z.enum(['active', 'ready', 'completed', 'archived']), targetDate: date.nullable(), rewardXp: integer, type: z.enum(['free', 'measurable']).default('free'), statisticId: id.nullable().default(null), comparator: z.enum(['gte', 'gt', 'lte', 'lt', 'eq']).default('gte'), target: z.number().finite().nullable().default(null) }),
  achievements: entity.extend({ challengeId: id, achievedAt: timestamp, goalKey: z.string().nullable().default(null), nameSnapshot: z.string().default(''), difficulty: difficultySchema.default('easy'), type: z.enum(['free', 'measurable']).default('free'), awardedWeek: date.nullable().default(null), evidenceValue: z.number().finite().nullable().default(null), evidenceDate: timestamp.nullable().default(null) }),
  commitments: entity.extend({ name, daysPerWeek: z.number().int().min(1).max(7), active: z.boolean(), description: z.string().max(2000).default(''), difficulty: difficultySchema.default('easy'), requiredDays: requiredDays.default([1,2,3,4,5,6,7]), deletedAt: timestamp.nullable().default(null) }),
  dietGoals: entity.extend({ name, target: nonnegative, unit: z.string().min(1).max(30), active: z.boolean(), description: z.string().max(2000).default(''), difficulty: difficultySchema.default('easy'), requiredDays: requiredDays.default([1,2,3,4,5,6,7]), objectives: z.array(z.string().min(1).max(200)).max(10).default([]), deletedAt: timestamp.nullable().default(null) }),
  xpRewards: entity.extend({ sourceType, sourceId: id, sourceKey: z.string().min(1).max(250), amount: integer, awardedAt: timestamp, weekStart: date.nullable().default(null), active: z.boolean().default(true), provisional: z.boolean().default(false), managed: z.boolean().default(false), label: z.string().default('Récompense antérieure'), revokedAt: timestamp.nullable().default(null) }),
  progression: entity.extend({ userId: id, level: z.number().int().min(1), totalXp: integer, title: name, rank: z.string().max(120).nullable() }),
  scheduleVersions: entity.extend({ effectiveStart: date.refine(value => new Date(`${value}T12:00:00`).getDay() === 1, 'La version doit commencer un lundi.'), programId: id.nullable(), programName: z.string().max(120), sessions: z.array(plannedSessionSchema) }),
  trainingChecks: entity.extend({ weekId: id, occurrenceId: id, targetId: id, checkedAt: timestamp }),
  trainingEvents: entity.extend({ weekId: id, occurrenceId: id, targetId: id, checked: z.boolean(), scheduledDate: date, recordedAt: timestamp }),
  habitSchedules: entity.extend({ effectiveStart: date, commitments: z.array(habitSchema).max(3), diet: habitSchema.nullable() }),
  dailyChecks: entity.extend({ weekId: id, habitId: id, date, state: z.enum(['respected', 'failed']) }),
} as const

export type TableName = keyof typeof schemas
export type Records = { [K in TableName]: z.infer<(typeof schemas)[K]> }
export type Snapshot = { [K in TableName]: Records[K][] }
export type Settings = Records['settings']
export const tableNames = Object.keys(schemas) as TableName[]

export const snapshotSchema = z.object({
  settings: z.array(schemas.settings).max(1),
  programs: z.array(schemas.programs),
  sessions: z.array(schemas.sessions),
  exercises: z.array(schemas.exercises),
  sessionExercises: z.array(schemas.sessionExercises),
  sets: z.array(schemas.sets),
  weeks: z.array(schemas.weeks),
  validations: z.array(schemas.validations),
  statisticDefinitions: z.array(schemas.statisticDefinitions),
  measurements: z.array(schemas.measurements),
  challenges: z.array(schemas.challenges),
  achievements: z.array(schemas.achievements),
  commitments: z.array(schemas.commitments),
  dietGoals: z.array(schemas.dietGoals),
  xpRewards: z.array(schemas.xpRewards),
  progression: z.array(schemas.progression).max(1),
  scheduleVersions: z.array(schemas.scheduleVersions).default([]),
  trainingChecks: z.array(schemas.trainingChecks).default([]),
  trainingEvents: z.array(schemas.trainingEvents).default([]),
  habitSchedules: z.array(schemas.habitSchedules).default([]),
  dailyChecks: z.array(schemas.dailyChecks).default([]),
}).strict()

/** Referential validation is shared by imports and future repository writes. */
export function validateRelations(data: Snapshot) {
  const ids = Object.fromEntries(tableNames.map(table => [table, new Set(data[table].map(row => row.id))])) as Record<TableName, Set<string>>
  for (const table of tableNames) {
    if (ids[table].size !== data[table].length) throw new Error(`Identifiants dupliqués : ${table}.`)
  }
  const ref = (table: TableName, value: string | null) => {
    if (value !== null && !ids[table].has(value)) throw new Error(`Référence absente dans « ${table} ».`)
  }
  for (const row of data.sessions) ref('programs', row.programId)
  for (const row of data.sessionExercises) { ref('sessions', row.sessionId); ref('exercises', row.exerciseId) }
  for (const row of data.sets) ref('sessionExercises', row.sessionExerciseId)
  for (const row of data.weeks) ref('programs', row.programId)
  for (const row of data.scheduleVersions) ref('programs', row.programId)
  for (const row of data.measurements) ref('statisticDefinitions', row.definitionId)
  for (const row of data.achievements) ref('challenges', row.challengeId)
  for (const row of data.progression) ref('settings', row.userId)
  const sources = { session: 'sessions', challenge: 'challenges', commitment: 'commitments', dietGoal: 'dietGoals', weeklyBonus: 'weeks' } as const
  for (const row of data.validations) { ref('weeks', row.weekId); ref(sources[row.sourceType], row.sourceId) }
  for (const row of data.xpRewards) {
    if (row.managed && row.sourceType === 'session') {
      if (!data.weeks.some(week => week.snapshot.some(session => session.id === row.sourceId))) throw new Error('Récompense sans occurrence sportive.')
    } else ref(sources[row.sourceType], row.sourceId)
  }
  for (const row of data.challenges) { ref('statisticDefinitions', row.statisticId); if (row.type === 'measurable' && (!row.statisticId || row.target === null)) throw new Error('Défi mesurable incomplet.') }
  for (const id of data.settings[0]?.favoriteStatisticIds ?? []) ref('statisticDefinitions', id)
  const unique = (values: string[], label: string) => { if (new Set(values).size !== values.length) throw new Error(`Doublons : ${label}.`) }
  unique(data.xpRewards.map(row => row.sourceKey), 'récompenses XP')
  unique(data.weeks.map(row => row.startDate), 'semaines')
  unique(data.achievements.map(row => row.challengeId), 'réalisations')
  unique(data.achievements.flatMap(row => row.goalKey ? [row.goalKey] : []), 'objectifs déjà récompensés')
  unique(data.habitSchedules.map(row => row.effectiveStart), 'versions des engagements')
  unique(data.dailyChecks.map(row => `${row.weekId}:${row.habitId}:${row.date}`), 'validations quotidiennes')
  for (const row of data.dailyChecks) {
    const week = data.weeks.find(week => week.id === row.weekId)
    const habit = week && [...week.commitmentSnapshot, ...(week.dietSnapshot ? [week.dietSnapshot] : [])].find(habit => habit.id === row.habitId)
    const index = week ? Math.round((new Date(`${row.date}T12:00:00`).getTime() - new Date(`${week.startDate}T12:00:00`).getTime()) / 86400000) + 1 : 0
    if (!habit || !habit.requiredDays.includes(index)) throw new Error('Validation quotidienne sans jour requis correspondant.')
  }
  unique(data.scheduleVersions.map(row => row.effectiveStart), 'versions du calendrier')
  unique(data.trainingChecks.map(row => `${row.weekId}:${row.targetId}`), 'validations de séries')
  if (data.programs.filter(row => row.active && !row.deletedAt).length > 1) throw new Error('Un seul programme peut être actif.')
  const nestedIds: string[] = []
  for (const week of data.weeks) {
    if (week.finalizedAt) {
      if (week.finalBaseXp === null || week.finalBonusXp === null || week.finalBonusPercent === null || week.finalBonusPercent > 60 || week.finalBonusXp !== Math.floor(week.finalBaseXp * week.finalBonusPercent / 100)) throw new Error('Bilan hebdomadaire figé incohérent.')
      const rewards = data.xpRewards.filter(row => row.active && row.weekStart === week.startDate)
      const base = rewards.filter(row => row.sourceType === 'session' || row.sourceType === 'challenge').reduce((sum,row) => sum + row.amount, 0)
      const bonus = rewards.filter(row => row.sourceType === 'weeklyBonus' && !row.provisional).reduce((sum,row) => sum + row.amount, 0)
      if (base !== week.finalBaseXp || bonus !== week.finalBonusXp) throw new Error('Le registre d’XP ne correspond pas au bilan hebdomadaire figé.')
    }
    for (const session of week.snapshot) {
      nestedIds.push(session.id)
      const expected = new Date(`${week.startDate}T12:00:00`)
      expected.setDate(expected.getDate() + session.weekday - 1)
      const actual = new Date(`${session.date}T12:00:00`)
      if (actual.getTime() !== expected.getTime()) throw new Error('Date de séance incompatible avec sa semaine.')
      for (const exercise of session.exercises) { nestedIds.push(exercise.id); for (const set of exercise.sets) nestedIds.push(set.id) }
    }
  }
  unique(nestedIds, 'identifiants des instantanés')
  for (const row of [...data.trainingChecks, ...data.trainingEvents]) {
    ref('weeks', row.weekId)
    const week = data.weeks.find(week => week.id === row.weekId)!
    const session = week.snapshot.find(session => session.id === row.occurrenceId)
    // Events intentionally retain removed targets as an immutable audit trail.
    if ('checkedAt' in row && (!session || !(session.exercises.length ? session.exercises.flatMap(ex => ex.sets).some(set => set.id === row.targetId) : session.id === row.targetId))) throw new Error('Validation sans série ou séance correspondante.')
    if ('scheduledDate' in row) {
      const eventDate = new Date(`${row.scheduledDate}T12:00:00`)
      const start = new Date(`${week.startDate}T12:00:00`)
      const end = new Date(start); end.setDate(end.getDate() + 7)
      if (eventDate < start || eventDate >= end || (session && session.date !== row.scheduledDate)) throw new Error('Date réelle incohérente dans le journal des validations.')
    }
  }
  if (data.settings.length !== 1 || data.progression.length !== 1) throw new Error('La sauvegarde doit contenir un profil et une progression.')
}
