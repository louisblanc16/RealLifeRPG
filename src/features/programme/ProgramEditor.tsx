import { useState, type FormEvent } from 'react'
import { CalendarDays, Plus, Save, Trash2 } from 'lucide-react'
import { Button, Input, Modal, Textarea, useToast } from '../../components/ui'
import type { PlannedSession, Records } from '../../domain/models'
import { newSession, weekdays } from '../../domain/training'
import { saveProgram } from '../../data/trainingRepository'
import { moveItem, OrderButtons, SessionFields } from './SessionFields'

export function ProgramEditor({ program, sessions: initial, onClose }: { program?: Records['programs']; sessions: PlannedSession[]; onClose: () => void }) {
  const [name, setName] = useState(program?.name ?? ''), [description, setDescription] = useState(program?.description ?? '')
  const [sessions, setSessions] = useState(initial), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const toast = useToast()
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await saveProgram({ id: program?.id, expectedUpdatedAt: program?.updatedAt, name, description, sessions }); toast('Programme enregistré. Les semaines existantes sont conservées.'); onClose() }
    catch (err) { setError(err instanceof Error && err.name !== 'ZodError' ? err.message : 'Vérifiez les noms, les séries et leurs valeurs.') } finally { setBusy(false) }
  }
  return <Modal open onClose={() => { if (!busy) onClose() }} title={program ? 'Modifier le programme' : 'Créer un programme'} description="Composez votre semaine. Plusieurs séances par jour, ou une journée de repos." wide><form onSubmit={save} onInvalidCapture={e => { const detail = (e.target as HTMLElement).closest('details'); if (detail) detail.open = true }}><fieldset disabled={busy} className="editor-body"><div className="form-grid"><Input label="Nom du programme" required maxLength={120} value={name} onChange={e => setName(e.target.value)} placeholder="Ex. Force & endurance" /><Textarea label="Description · facultatif" rows={2} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)} /></div><div className="editor-section-title"><h3><CalendarDays size={17} />Semaine type</h3><span>{sessions.length} séances</span></div>{sessions.map((session, index) => <details className="session-editor" key={session.id} open><summary><span className="editor-number">{String(index + 1).padStart(2, '0')}</span><span>{session.name || 'Nouvelle séance'}<small>{weekdays[session.weekday - 1]} · {session.exercises.length ? `${session.exercises.length} exercices` : 'Séance simple'}</small></span></summary><div className="session-editor-actions"><OrderButtons index={index} length={sessions.length} label="la séance" onMove={delta => setSessions(moveItem(sessions, index, delta))} /><Button variant="ghost" type="button" onClick={() => setSessions(sessions.filter(s => s.id !== session.id))}><Trash2 size={14} />Retirer la séance</Button></div><SessionFields session={session} onChange={value => setSessions(sessions.map(s => s.id === session.id ? value : s))} /></details>)}<Button type="button" variant="secondary" onClick={() => setSessions([...sessions, newSession()])}><Plus size={16} />Ajouter une séance</Button><p className="form-help">Les jours sans séance sont au repos. Les modifications du modèle actif préparent la prochaine semaine. Actualisez explicitement la semaine actuelle si elle n’a pas été commencée.</p>{error && <p className="inline-error" role="alert">{error}</p>}</fieldset><div className="editor-footer"><Button variant="secondary" type="button" disabled={busy} onClick={onClose}>Annuler</Button><Button type="submit" busy={busy}><Save size={16} />Enregistrer le programme</Button></div></form></Modal>
}
