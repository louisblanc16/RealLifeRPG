import { useRef, useState } from 'react'
import { Check, Minus, X } from 'lucide-react'
import type { Habit, Records } from '../domain/models'
import { addDays, weekEditable } from '../domain/dates'
import { useData, useLocalDay } from '../data/context'
import { rpgService } from '../data/rpgRepository'
import { useToast } from './ui'

/** The same write boundary and rows drive both the dashboard and weekly tracker. */
export function DailyCheckControl({ week, habit, date, showStatus = false }: { week: Records['weeks']; habit: Habit; date: string; showStatus?: boolean }) {
  const data = useData(), today = useLocalDay(), toast = useToast(), pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const state = data.dailyChecks.find(row => row.weekId === week.id && row.habitId === habit.id && row.date === date)?.state
  const required = habit.requiredDays.some(day => addDays(week.startDate, day - 1) === date)
  const disabled = busy || !!week.finalizedAt || !weekEditable(week.startDate) || !required || date > today
  async function update(value: 'respected' | 'failed' | null) {
    if (disabled || pending.current) return
    pending.current = true; setBusy(true)
    try { await rpgService.setDailyState(week.id, habit.id, date, value) }
    catch (error) { toast(error instanceof Error ? error.message : 'Validation impossible.', 'error') }
    finally { pending.current = false; setBusy(false) }
  }
  return <div className={`daily-check-control daily-control-${state ?? 'empty'}`} aria-busy={busy || undefined}>{showStatus && <span className="daily-action-state">{!required ? 'Non requis' : state === 'respected' ? 'Respecté' : state === 'failed' ? 'Non respecté' : 'Non renseigné'}</span>}<div className="daily-check-buttons" role="group" aria-label={`${habit.name} · ${date}`}>
    <button type="button" title="Respecté" aria-label={`${habit.name} : respecté le ${date}`} aria-pressed={state === 'respected'} disabled={disabled} onClick={() => void update('respected')}><Check size={17} /></button>
    <button type="button" title="Non respecté" aria-label={`${habit.name} : non respecté le ${date}`} aria-pressed={state === 'failed'} disabled={disabled} onClick={() => void update('failed')}><X size={17} /></button>
    <button type="button" title="Non renseigné" aria-label={`${habit.name} : non renseigné le ${date}`} aria-pressed={!state} disabled={disabled || !state} onClick={() => void update(null)}><Minus size={17} /></button>
  </div></div>
}
