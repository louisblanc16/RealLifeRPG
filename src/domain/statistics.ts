import type { Records } from './models'

export const presets = [
  { key: 'weight', name: 'Poids corporel', unit: 'kg', kind: 'weight', valueType: 'decimal', direction: 'neutral' },
  { key: 'pushups', name: 'Pompes classiques max', unit: 'rép.', kind: 'performance', valueType: 'integer', direction: 'higher' },
  { key: 'diamond', name: 'Muscles-up max', unit: 'rép.', kind: 'performance', valueType: 'integer', direction: 'higher' },
  { key: 'pullups', name: 'Tractions max', unit: 'rép.', kind: 'performance', valueType: 'integer', direction: 'higher' },
  { key: 'plank', name: 'Gainage planche maximal', unit: 's', kind: 'performance', valueType: 'duration', direction: 'higher' },
  { key: 'vma', name: 'VMA', unit: 'km/h', kind: 'performance', valueType: 'decimal', direction: 'higher' },
  { key: 'running', name: 'Course à pied', unit: 'km', kind: 'performance', valueType: 'decimal', direction: 'higher' },
] as const
export function orderedMeasures(rows: Records['measurements'][]) { return [...rows].sort((a, b) => new Date(a.measuredAt).getTime() - new Date(b.measuredAt).getTime() || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)) }
export function personalRecord(def: Records['statisticDefinitions'], rows: Records['measurements'][]) {
  if (def.direction === 'neutral' || !rows.length) return null
  return rows.reduce((best, row) => def.direction === 'higher' ? row.value > best.value ? row : best : row.value < best.value ? row : best)
}
export function formatValue(value: number) { return value.toLocaleString('fr-FR', { maximumFractionDigits: 3 }) }
export function variation(rows: Records['measurements'][]) { const sorted = orderedMeasures(rows); return sorted.length < 2 ? null : sorted.at(-1)!.value - sorted.at(-2)!.value }
