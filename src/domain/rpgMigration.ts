import { snapshotSchema, type Snapshot } from './models'
import { difficulty } from './rpgConfig'
import { goalKey } from './xp'
import { weekStart } from './dates'
import { sessionProgress } from './training'

export function upgradeRpgData(input: Snapshot): Snapshot {
  const data = snapshotSchema.parse(input)
  for (const challenge of data.challenges) { if (challenge.difficulty === 'epic') challenge.difficulty = 'hard'; challenge.rewardXp = difficulty(challenge.difficulty).challengeXp }
  for (const achievement of data.achievements) {
    const challenge = data.challenges.find(c => c.id === achievement.challengeId)
    if (!achievement.nameSnapshot && challenge) {
      achievement.nameSnapshot = challenge.name; achievement.difficulty = challenge.difficulty === 'epic' ? 'hard' : challenge.difficulty; achievement.type = challenge.type; achievement.goalKey = goalKey(challenge)
    }
    achievement.awardedWeek ??= weekStart(new Date(achievement.achievedAt))
  }
  for (const reward of data.xpRewards) {
    reward.weekStart ??= weekStart(new Date(reward.awardedAt))
    if (reward.sourceType === 'challenge' && data.achievements.some(a => a.challengeId === reward.sourceId)) { reward.sourceKey = `challenge:${reward.sourceId}`; reward.managed = true }
    if (reward.sourceType === 'session' && !reward.managed) {
      const candidates = data.weeks.flatMap(week => week.snapshot.filter(session => session.sourceSessionId === reward.sourceId).map(session => ({ week, session, checks: data.trainingChecks.filter(check => check.weekId === week.id && check.occurrenceId === session.id) })))
      const completed = candidates.filter(item => sessionProgress(item.session, item.checks).status === 'completed').sort((a,b) => {
        const distance = (item: typeof a) => Math.abs(Math.max(...item.checks.map(check => new Date(check.checkedAt).getTime())) - new Date(reward.awardedAt).getTime())
        return distance(a) - distance(b)
      })
      const match = completed[0] ?? candidates.find(item => item.week.startDate === reward.weekStart)
      if (match) { reward.weekStart = match.week.startDate; reward.sourceId = match.session.id; reward.sourceKey = `session:${match.week.id}:${match.session.id}`; reward.managed = true }
    }
  }
  const keys = new Set<string>()
  for (const reward of data.xpRewards) {
    if (keys.has(reward.sourceKey)) { reward.sourceKey = `legacy-duplicate:${reward.id}`; reward.active = false; reward.managed = true; reward.revokedAt ??= reward.updatedAt; reward.label = 'Doublon antérieur révoqué' }
    keys.add(reward.sourceKey)
  }
  return data
}
