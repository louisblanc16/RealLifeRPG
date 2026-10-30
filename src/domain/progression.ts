import type { Records } from './models'
import { DIFFICULTIES, RANKS, SESSION_XP } from './rpgConfig'

export function levelThreshold(level: number) {
  const n = Math.max(0, Math.floor(level) - 1)
  return 110 * n + 6 * n * n
}

export function calculateProgression(xp: number) {
  const totalXp = Math.max(0, Math.floor(xp))
  let low = 1, high = 2
  while (levelThreshold(high) <= totalXp) high *= 2
  while (high - low > 1) { const middle = Math.floor((low + high) / 2); if (levelThreshold(middle) <= totalXp) low = middle; else high = middle }
  const currentThreshold = levelThreshold(low), nextLevelXp = levelThreshold(low + 1)
  const rank = [...RANKS].reverse().find(rank => low >= rank.min)!
  return { level: low, totalXp, currentThreshold, nextLevelXp, levelXp: totalXp - currentThreshold, levelSpan: nextLevelXp - currentThreshold, remainingXp: nextLevelXp - totalXp, percent: (totalXp - currentThreshold) / (nextLevelXp - currentThreshold) * 100, title: rank.title, rank }
}

export function progressionView(profile: Records['progression']) {
  return calculateProgression(profile.totalXp)
}

/** Development calibration: 4.5 sessions/week, 2 medium + 1 easy challenges/month,
 * four habits at 35% combined, respected 80% of the time. No simulated UI data. */
export function calibrateProgression() {
  const weeklyBase = 4.5 * SESSION_XP + (2 * DIFFICULTIES.medium.challengeXp + DIFFICULTIES.easy.challengeXp) * 12 / 52
  const combinedBonus = (2 * DIFFICULTIES.easy.bonusPercent + DIFFICULTIES.medium.bonusPercent + DIFFICULTIES.hard.bonusPercent) / 100
  return [1, 3, 5].map(years => ({ years, ...calculateProgression(Math.floor(years * 52 * weeklyBase * (1 + combinedBonus * .8))) }))
}
