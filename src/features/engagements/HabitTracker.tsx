import { CheckCircle2, LockKeyhole } from 'lucide-react'
import { Badge, Card } from '../../components/ui'
import { useData, useLocalDay } from '../../data/context'
import { addDays, weekEditable } from '../../domain/dates'
import type { Habit, Records } from '../../domain/models'
import { difficulty } from '../../domain/rpgConfig'
import { habitState } from '../../domain/xp'
import { weekdays } from '../../domain/training'
import { DailyCheckControl } from '../../components/DailyCheckControl'

export function HabitTracker({ habit, week, label }: { habit: Habit; week: Records['weeks']; label: string }) {
  const data = useData(), today = useLocalDay(), result = habitState(habit, week, data.dailyChecks), locked = !!week.finalizedAt || !weekEditable(week.startDate)
  return <Card className={`habit-tracker habit-${result.status}`}><div className="habit-tracker-header"><div><span className="card-eyebrow">{label}</span><h2>{habit.name}</h2>{habit.description && <p>{habit.description}</p>}</div><Badge tone={result.status === 'succeeded' ? 'green' : result.status === 'failed' ? 'neutral' : 'purple'}>{result.status === 'succeeded' ? <CheckCircle2 size={12} /> : locked ? <LockKeyhole size={12} /> : null}{result.status === 'succeeded' ? 'Tous les jours respectés' : result.status === 'failed' ? 'Bonus annulé · échec' : `${result.done} / ${result.required} jours respectés`}</Badge></div>{habit.calories !== null && <div className="diet-objectives"><span>{habit.calories} kcal / jour</span>{habit.objectives.map((objective,index) => <span key={index}>{objective}</span>)}</div>}<div className="daily-tracker">{weekdays.map((day,index) => {
    const date = addDays(week.startDate, index), required = habit.requiredDays.includes(index + 1), state = data.dailyChecks.find(row => row.weekId === week.id && row.habitId === habit.id && row.date === date)?.state
    return <div className={`daily-cell daily-${state ?? 'empty'} ${date === today ? 'daily-today' : ''}`} key={date}><span>{day.slice(0,3)} <strong>{new Date(`${date}T12:00:00`).getDate()}</strong></span><small>{!required ? 'Non requis' : state === 'respected' ? 'Respecté' : state === 'failed' ? 'Échoué' : 'Non renseigné'}</small><DailyCheckControl week={week} habit={habit} date={date} /></div>
  })}</div><p className="habit-rule">{difficulty(habit.difficulty).label} · +{difficulty(habit.difficulty).bonusPercent} % de l’XP de base si tous les jours requis sont respectés. {locked ? 'Semaine verrouillée.' : 'Bonus provisoire jusqu’au verrouillage.'}</p></Card>
}
