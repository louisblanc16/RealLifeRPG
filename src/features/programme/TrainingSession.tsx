import { useState } from 'react'
import { Check, CheckCircle2, Circle, Edit3, LockKeyhole, Save } from 'lucide-react'
import { Badge, Button, Modal, Progress, useToast } from '../../components/ui'
import { useData, useLocalDay } from '../../data/context'
import { lockLabel, weekEditable } from '../../domain/dates'
import { sessionProgress } from '../../domain/training'
import { saveWeekSession, setTrainingCheck } from '../../data/trainingRepository'
import type { PlannedSession } from '../../domain/models'
import { SessionFields } from './SessionFields'
import { SESSION_XP } from '../../domain/rpgConfig'

export function TrainingSession({ weekId, occurrenceId, onClose }: { weekId: string; occurrenceId: string; onClose: () => void }) {
  const data = useData(), today = useLocalDay(), toast = useToast()
  const week = data.weeks.find(w => w.id === weekId)!, session = week?.snapshot.find(s => s.id === occurrenceId)
  const [busyTargets, setBusyTargets] = useState<string[]>([]), [draft, setDraft] = useState<{ session: PlannedSession; version: string } | null>(null), [saving, setSaving] = useState(false), [error, setError] = useState('')
  if (!session) return null
  const locked = !!week.finalizedAt || !weekEditable(week.startDate), future = session.date > today, progress = sessionProgress(session, data.trainingChecks)
  const checks = new Set(data.trainingChecks.filter(c => c.weekId === weekId && c.occurrenceId === occurrenceId).map(c => c.targetId))
  async function toggle(targetId: string) {
    if (busyTargets.includes(targetId)) return
    setBusyTargets(ids => [...ids, targetId]); setError('')
    try { await setTrainingCheck(weekId, occurrenceId, targetId, !checks.has(targetId)) } catch (err) { const message = err instanceof Error ? err.message : 'Validation impossible.'; setError(message); toast(message, 'error') } finally { setBusyTargets(ids => ids.filter(id => id !== targetId)) }
  }
  async function save() {
    if (!draft) return
    setSaving(true); setError('')
    try { await saveWeekSession(weekId, draft.session, draft.version); setDraft(null); toast('Séance de cette semaine mise à jour.') } catch (err) { setError(err instanceof Error && err.name !== 'ZodError' ? err.message : 'Vérifiez les champs et les séries.') } finally { setSaving(false) }
  }
  return <Modal open onClose={() => { if (!saving && !busyTargets.length) onClose() }} title={draft ? 'Modifier cette séance' : session.name} description={`${new Date(`${session.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${session.activity}`} wide>{draft ? <form onSubmit={e => { e.preventDefault(); void save() }}><fieldset className="editor-body" disabled={saving}><SessionFields session={draft.session} dateLocked onChange={value => setDraft({ ...draft, session: value })} /><p className="form-help">Seule cette occurrence est modifiée. Retirer une série retire sa validation ; le journal des événements est conservé.</p>{error && <p role="alert" className="inline-error">{error}</p>}</fieldset><div className="editor-footer"><Button variant="secondary" type="button" disabled={saving} onClick={() => { setDraft(null); setError('') }}>Annuler</Button><Button type="submit" busy={saving}><Save size={15} />Enregistrer</Button></div></form> : <div className="training-body"><div className="training-status"><Badge tone={progress.status === 'completed' ? 'green' : progress.status === 'partial' ? 'purple' : 'neutral'}>{progress.status === 'completed' ? 'Terminée' : progress.status === 'partial' ? 'En cours' : 'À réaliser'}</Badge><span>{progress.done} / {progress.total} {session.exercises.length ? 'séries' : 'séance'}</span>{!locked && <Button variant="ghost" disabled={!!busyTargets.length} onClick={() => setDraft({ session: structuredClone(session), version: week.updatedAt })}><Edit3 size={14} />Modifier</Button>}</div><Progress value={progress.done} max={progress.total} label="Progression de la séance" />{progress.status === 'completed' && <p className="habit-rule">{data.xpRewards.some(row => row.sourceType === 'session' && row.sourceId === occurrenceId && row.active) ? `Séance récompensée : ${SESSION_XP} XP, attribués à sa semaine prévue.` : 'Séance suivie sans XP supplémentaire : sept séances maximum sont récompensées par semaine.'}</p>}{session.description && <p className="session-description">{session.description}</p>}{session.exercises.length ? <div className="training-exercises">{session.exercises.map((exercise, index) => {
    const done = exercise.sets.every(set => checks.has(set.id))
    return <section className={`training-exercise ${done ? 'exercise-done' : ''}`} key={exercise.id}><div className="exercise-title"><span className="editor-number">{String(index + 1).padStart(2, '0')}</span><h3>{exercise.name}</h3>{done ? <CheckCircle2 size={17} /> : <Badge>{exercise.sets.filter(s => checks.has(s.id)).length} / {exercise.sets.length}</Badge>}</div>{exercise.instructions && <p className="exercise-instructions">{exercise.instructions}</p>}<div className="training-sets">{exercise.sets.map((set, index) => <button key={set.id} className={`training-set ${checks.has(set.id) ? 'set-done' : ''}`} aria-pressed={checks.has(set.id)} disabled={locked || future || busyTargets.includes(set.id)} onClick={() => void toggle(set.id)}><span className="check-box">{checks.has(set.id) && <Check size={15} />}</span><span>Série {index + 1}</span><strong>{set.durationSeconds !== null ? `${set.durationSeconds} s` : set.reps !== null ? `${set.reps} répétitions` : 'Série libre'}{set.weightKg !== null && <small> · {set.weightKg} kg</small>}</strong><span className="set-state">{busyTargets.includes(set.id) ? 'Enregistrement…' : checks.has(set.id) ? 'Validée' : 'Valider'}</span></button>)}</div></section>
  })}</div> : <Button className="simple-validate" variant={checks.has(session.id) ? 'secondary' : 'primary'} disabled={locked || future} busy={busyTargets.includes(session.id)} aria-pressed={checks.has(session.id)} onClick={() => void toggle(session.id)}>{checks.has(session.id) ? <CheckCircle2 size={18} /> : <Circle size={18} />}{checks.has(session.id) ? 'Séance terminée · décocher' : 'Valider la séance'}</Button>}{error && <p role="alert" className="inline-error">{error}</p>}<p className="training-lock-note"><LockKeyhole size={13} />{locked ? 'Semaine archivée · validations verrouillées.' : future ? 'Les validations seront disponibles à la date prévue.' : `Modifiable jusqu’au ${lockLabel(week.startDate)}.`}</p></div>}</Modal>
}
