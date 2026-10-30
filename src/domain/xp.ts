import type { Habit, Records, Snapshot } from './models'
import { addDays, localDate, weekStart } from './dates'
import { difficulty, MAX_REWARDED_SESSIONS, SESSION_XP } from './rpgConfig'
import { sessionProgress, sessionTargets } from './training'

export function goalKey(challenge: Pick<Records['challenges'], 'type' | 'statisticId' | 'comparator' | 'target'>) {
  return challenge.type === 'measurable' && challenge.statisticId && challenge.target !== null ? `${challenge.statisticId}|${challenge.comparator}|${Object.is(challenge.target, -0) ? 0 : challenge.target}` : null
}
export function compareValue(value: number, operator: Records['challenges']['comparator'], target: number) {
  switch (operator) { case 'gte': return value >= target; case 'gt': return value > target; case 'lte': return value <= target; case 'lt': return value < target; case 'eq': return value === target }
}
export function challengeEvidence(challenge: Records['challenges'], measurements: Records['measurements'][], now = new Date()) {
  if (challenge.type !== 'measurable' || !challenge.statisticId || challenge.target === null) return null
  const admissible = measurements.filter(m => m.definitionId === challenge.statisticId && new Date(m.measuredAt) <= now && compareValue(m.value, challenge.comparator, challenge.target!))
  return admissible.sort((a, b) => challenge.comparator === 'lte' || challenge.comparator === 'lt' ? a.value - b.value : b.value - a.value)[0] ?? null
}
export function eligibleChallenges(data: Pick<Snapshot, 'challenges' | 'measurements' | 'achievements' | 'xpRewards'>, now = new Date()) {
  const awardedIds = new Set([...data.achievements.map(row => row.challengeId), ...data.xpRewards.filter(row => row.sourceType === 'challenge').map(row => row.sourceId)])
  const awardedGoals = new Set(data.achievements.flatMap(row => row.goalKey ? [row.goalKey] : []))
  return data.challenges.filter(challenge => challenge.type === 'measurable'
    && (challenge.status === 'active' || challenge.status === 'ready') && !awardedIds.has(challenge.id)
    && !awardedGoals.has(goalKey(challenge) ?? '') && !!challengeEvidence(challenge, data.measurements, now))
}
export function habitState(habit: Habit, week: Records['weeks'], checks: Records['dailyChecks'][]) {
  const states = habit.requiredDays.map(day => checks.find(row => row.weekId === week.id && row.habitId === habit.id && row.date === addDays(week.startDate, day - 1))?.state)
  return { status: states.includes('failed') ? 'failed' : states.every(state => state === 'respected') ? 'succeeded' : 'pending', done: states.filter(state => state === 'respected').length, required: states.length } as const
}
export type DesiredReward = Pick<Records['xpRewards'], 'sourceKey' | 'sourceType' | 'sourceId' | 'amount' | 'awardedAt' | 'weekStart' | 'provisional' | 'label'>
export function earnedXp(rewards: Records['xpRewards'][]) { return rewards.filter(row => row.active && !row.provisional).reduce((sum, row) => sum + row.amount, 0) }

/** Sole XP policy: no React, database, side effects or random identifiers. */
export function calculateWeekXp(data: Snapshot, week: Records['weeks'], now = new Date()) {
  const today = localDate(now)
  const completed = week.snapshot.filter(session => session.date <= today && sessionProgress(session, data.trainingChecks).status === 'completed').map(session => {
    const targetIds = new Set(sessionTargets(session))
    const dates = data.trainingChecks.filter(check => check.weekId === week.id && check.occurrenceId === session.id && targetIds.has(check.targetId)).map(check => check.checkedAt).sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
    return { session, completedAt: dates.at(-1)! }
  }).sort((a, b) => new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime() || a.session.date.localeCompare(b.session.date) || a.session.id.localeCompare(b.session.id))
  const rewards: DesiredReward[] = completed.slice(0, MAX_REWARDED_SESSIONS).map(({ session, completedAt }) => ({ sourceKey: `session:${week.id}:${session.id}`, sourceType: 'session', sourceId: session.id, amount: SESSION_XP, awardedAt: completedAt, weekStart: week.startDate, provisional: false, label: session.name }))
  for (const achievement of data.achievements) if ((achievement.awardedWeek ?? weekStart(new Date(achievement.achievedAt))) === week.startDate) {
    rewards.push({ sourceKey: `challenge:${achievement.challengeId}`, sourceType: 'challenge', sourceId: achievement.challengeId, amount: difficulty(achievement.difficulty).challengeXp, awardedAt: achievement.achievedAt, weekStart: week.startDate, provisional: false, label: achievement.nameSnapshot || data.challenges.find(c => c.id === achievement.challengeId)?.name || 'Défi accompli' })
  }
  // Unmatched pre-engine rewards remain visible and are never silently deleted.
  const legacyBase = data.xpRewards.filter(row => !row.managed && row.active && (row.sourceType === 'session' || row.sourceType === 'challenge') && row.weekStart === week.startDate && !rewards.some(reward => reward.sourceKey === row.sourceKey)).reduce((sum, row) => sum + row.amount, 0)
  const baseXp = rewards.reduce((sum, row) => sum + row.amount, 0) + legacyBase
  const habits = [...week.commitmentSnapshot, ...(week.dietSnapshot ? [week.dietSnapshot] : [])]
  const successfulPercent = habits.reduce((sum, habit) => sum + (habitState(habit, week, data.dailyChecks).status === 'succeeded' ? difficulty(habit.difficulty).bonusPercent : 0), 0)
  const possiblePercent = habits.reduce((sum, habit) => sum + (habitState(habit, week, data.dailyChecks).status !== 'failed' ? difficulty(habit.difficulty).bonusPercent : 0), 0)
  const bonusXp = Math.floor(baseXp * successfulPercent / 100)
  return { rewards, baseXp, bonusXp, successfulPercent, possiblePercent, potentialBonusXp: Math.floor(baseXp * possiblePercent / 100), rewardedSessions: Math.min(completed.length, MAX_REWARDED_SESSIONS), completedSessions: completed.length }
}

export function weeklyXpView(data: Snapshot, week: Records['weeks'] | undefined, now = new Date()) {
  if (!week) return { baseXp: 0, bonusXp: 0, successfulPercent: 0, possiblePercent: 0, potentialBonusXp: 0, rewardedSessions: 0, completedSessions: 0, finalized: false }
  const result = calculateWeekXp(data, week, now)
  return week.finalizedAt ? { ...result, baseXp: week.finalBaseXp ?? result.baseXp, bonusXp: week.finalBonusXp ?? result.bonusXp, successfulPercent: week.finalBonusPercent ?? result.successfulPercent, potentialBonusXp: week.finalBonusXp ?? result.bonusXp, finalized: true } : { ...result, finalized: false }
}
