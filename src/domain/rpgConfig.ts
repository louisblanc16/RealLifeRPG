export const DIFFICULTIES = {
  easy: { label: 'Facile', challengeXp: 50, bonusPercent: 5 },
  medium: { label: 'Moyen', challengeXp: 150, bonusPercent: 10 },
  hard: { label: 'Difficile', challengeXp: 400, bonusPercent: 15 },
} as const
export type Difficulty = keyof typeof DIFFICULTIES
export function difficulty(value: string) { return DIFFICULTIES[value as Difficulty] ?? DIFFICULTIES.hard }
export const SESSION_XP = 30
export const MAX_REWARDED_SESSIONS = 7
export const MAX_COMMITMENTS = 3
export const RANKS = [
  { min: 0, max: 9, title: 'Figurant', color: '#9899a4', style: 'stone' },
  { min: 10, max: 19, title: 'Poids mort', color: '#a4a3ad', style: 'stone' },
  { min: 20, max: 29, title: 'Recrue', color: '#8cb39b', style: 'sage' },
  { min: 30, max: 39, title: 'Combattant', color: '#a998d1', style: 'violet' },
  { min: 40, max: 49, title: 'Prédateur', color: '#b79bcf', style: 'violet' },
  { min: 50, max: 59, title: 'Élite', color: '#c2ae7d', style: 'gold' },
  { min: 60, max: 79, title: 'Seigneur de guerre', color: '#ccba8c', style: 'gold' },
  { min: 80, max: 99, title: 'Mythe vivant', color: '#cbb2df', style: 'mythic' },
  { min: 100, max: Infinity, title: 'Ascendant', color: '#deca98', style: 'ascendant' },
] as const
// Future cosmetic slots are independent from XP and carry no gameplay modifiers.
export type CosmeticSlot = 'aura'
export const COMPARATORS = { gte: '≥', gt: '>', lte: '≤', lt: '<', eq: '=' } as const
