import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Apple, ArrowUpRight, CheckCircle2, Coffee, Dumbbell, Leaf, ListChecks } from 'lucide-react'
import { Badge, Card } from '../../components/ui'
import { SectionHeading } from '../../components/overview'
import { DailyCheckControl } from '../../components/DailyCheckControl'
import { useData, useLocalDay } from '../../data/context'
import { addDays, weekStart } from '../../domain/dates'
import { sessionProgress } from '../../domain/training'
import { TrainingSession } from '../programme/TrainingSession'

export function DailyActions() {
  const data = useData(), today = useLocalDay()
  const week = data.weeks.find(row => row.startDate === weekStart(new Date(`${today}T12:00:00`)))
  const [opened, setOpened] = useState<string | null>(null)
  const sessions = week?.snapshot.filter(session => session.date === today) ?? []
  const commitments = week?.commitmentSnapshot.filter(habit => habit.requiredDays.some(day => addDays(week.startDate, day - 1) === today)) ?? []
  return <Card className="daily-actions"><SectionHeading icon={ListChecks} title="Actions du jour"><span className="daily-date">{new Date(`${today}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span></SectionHeading>
    <div className="daily-section-label">Entraînement</div><div className="daily-sessions">{sessions.length ? sessions.map(session => {
      const progress = sessionProgress(session, data.trainingChecks)
      return <button type="button" key={session.id} className={`today-session session-${progress.status}`} onClick={() => setOpened(session.id)}><span className="today-icon">{progress.status === 'completed' ? <CheckCircle2 size={19} /> : <Dumbbell size={19} />}</span><span className="daily-session-name"><strong>{session.name}</strong><small>{session.activity} · {progress.done} / {progress.total} {session.exercises.length ? 'séries' : 'séance'}</small></span><Badge tone={progress.status === 'completed' ? 'green' : progress.status === 'partial' ? 'purple' : 'neutral'}>{progress.status === 'completed' ? 'Terminée' : progress.status === 'partial' ? 'En cours' : 'À réaliser'}</Badge><ArrowUpRight size={15} /></button>
    }) : <div className="daily-rest"><Coffee size={18} /><span>{week ? 'Repos · aucune séance planifiée.' : 'Aucune séance planifiée.'}</span><Link to="/programme">Calendrier<ArrowUpRight size={14} /></Link></div>}</div>
    <div className="daily-section-label">Diète & engagements</div>{week?.dietSnapshot ? <div className="daily-habit-row"><span className="daily-habit-icon"><Apple size={18} /></span><div className="daily-habit-name"><strong>{week.dietSnapshot.name}</strong><small>Diète · {week.dietSnapshot.calories} kcal / jour</small></div><DailyCheckControl week={week} habit={week.dietSnapshot} date={today} showStatus /></div> : <div className="daily-rest"><Apple size={18} /><span>Diète non configurée pour cette semaine.</span><Link to="/engagements">Configurer<ArrowUpRight size={14} /></Link></div>}
    {week && commitments.map(habit => <div className="daily-habit-row" key={habit.id}><span className="daily-habit-icon"><Leaf size={18} /></span><div className="daily-habit-name"><strong>{habit.name}</strong><small>Engagement personnel · bonus hebdomadaire</small></div><DailyCheckControl week={week} habit={habit} date={today} showStatus /></div>)}
    {!commitments.length && <p className="daily-no-commitment">Aucun engagement personnel requis aujourd’hui.</p>}
    {opened && week && <TrainingSession weekId={week.id} occurrenceId={opened} onClose={() => setOpened(null)} />}
  </Card>
}
