import { useState } from 'react'
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Coffee, LockKeyhole } from 'lucide-react'
import { Badge, Button, Card, Progress } from '../../components/ui'
import { useData, useLocalDay } from '../../data/context'
import { addDays, weekEditable, weekLabel, weekStart } from '../../domain/dates'
import { sessionProgress, weekdays, weekProgress } from '../../domain/training'
import { TrainingSession } from './TrainingSession'

export function WeekCalendar() {
  const data = useData(), today = useLocalDay(), currentStart = weekStart(new Date(`${today}T12:00:00`))
  const [selection, setSelection] = useState<string | null>(null), [opened, setOpened] = useState<{ weekId: string; occurrenceId: string } | null>(null)
  const start = selection ?? currentStart, week = data.weeks.find(w => w.startDate === start), locked = !weekEditable(start)
  const revision = [...data.scheduleVersions].sort((a, b) => a.effectiveStart.localeCompare(b.effectiveStart)).filter(v => v.effectiveStart <= start).at(-1)
  const projected = !week && start > currentStart && revision ? revision.sessions.map(s => ({ ...s, date: addDays(start, s.weekday - 1) })) : []
  const progress = week ? weekProgress(week, data.trainingChecks) : { done: 0, total: projected.length }
  const earliest = [...data.weeks.map(w => w.startDate), currentStart].sort()[0]
  return <><Card className="calendar-card"><div className="calendar-toolbar"><div><h2><CalendarDays size={18} />Calendrier hebdomadaire</h2><p>{week?.programName ?? (start > currentStart ? 'Semaine à venir · le planning sera figé au début de la semaine' : 'Aucun programme enregistré pour cette semaine')}</p></div><div className="calendar-navigation"><Button variant="ghost" className="icon-button" aria-label="Semaine précédente" disabled={start <= earliest} onClick={() => setSelection(addDays(start, -7))}><ChevronLeft size={18} /></Button><span>{weekLabel(new Date(`${start}T12:00:00`))}</span><Button variant="ghost" className="icon-button" aria-label="Semaine suivante" onClick={() => setSelection(addDays(start, 7))}><ChevronRight size={18} /></Button><Button variant="secondary" disabled={start === currentStart} onClick={() => setSelection(null)}>Aujourd’hui</Button><input className="input calendar-jump" type="date" aria-label="Choisir une semaine" value={start} min={earliest} onChange={e => { if (e.target.value) setSelection(weekStart(new Date(`${e.target.value}T12:00:00`))) }} /></div></div><div className="calendar-progress"><span>{progress.done} / {progress.total} séances terminées</span><Progress value={progress.done} max={progress.total} label="Progression hebdomadaire" /><Badge tone={locked ? 'neutral' : start === currentStart ? 'purple' : 'neutral'}>{locked ? <><LockKeyhole size={11} />Verrouillée</> : start === currentStart ? 'Cette semaine' : start < currentStart ? 'Rattrapage' : 'À venir'}</Badge></div><div className="training-calendar">{weekdays.map((day, index) => {
    const key = addDays(start, index), sessions = (week?.snapshot ?? projected).filter(s => s.date === key)
    return <div key={key} className={`calendar-day ${key === today ? 'calendar-today' : ''}`}><div className="calendar-day-heading"><span>{day}</span><strong>{new Date(`${key}T12:00:00`).getDate()}</strong>{key === today && <span className="status-dot" />}</div><div className="calendar-day-content">{sessions.length ? sessions.map(session => {
      const result = sessionProgress(session, data.trainingChecks)
      return <button key={session.id} disabled={!week} title={!week ? 'Prévision : disponible au début de cette semaine.' : undefined} onClick={() => { if (week) setOpened({ weekId: week.id, occurrenceId: session.id }) }} className={`session-tile session-${result.status}`}><span>{session.activity}</span><strong>{session.name}</strong><small>{!week ? 'Prévision' : result.status === 'completed' ? <><CheckCircle2 size={12} />Terminée</> : result.status === 'partial' ? `${result.done} / ${result.total} séries` : session.exercises.length ? `${session.exercises.length} exercices` : 'Séance simple'}</small></button>
    }) : <div className="rest-day"><Coffee size={17} strokeWidth={1.3} /><span>{week ? 'Repos' : 'Non planifié'}</span></div>}</div></div>
  })}</div></Card>{opened && <TrainingSession key={`${opened.weekId}:${opened.occurrenceId}`} {...opened} onClose={() => setOpened(null)} />}</>
}
