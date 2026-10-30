import { Link } from 'react-router-dom'
import { ArrowRight, CalendarDays, Check, Circle, Shield, Sparkles, type LucideIcon } from 'lucide-react'
import { useData, useLocalDay } from '../data/context'
import { currentWeek, weekLabel } from '../domain/dates'
import { progressionView } from '../domain/progression'
import { Badge, Card, Progress } from './ui'
import { sessionProgress, weekProgress } from '../domain/training'
import { earnedXp } from '../domain/xp'

export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: React.ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span />{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{children}</div>
}

export function SectionHeading({ icon: Icon, title, to, label = 'Tout voir', children }: { icon: LucideIcon; title: string; to?: string; label?: string; children?: React.ReactNode }) {
  return <div className="section-heading"><h2><Icon size={18} strokeWidth={1.6} />{title}</h2>{to ? <Link className="text-link" to={to}>{label}<ArrowRight size={14} /></Link> : children}</div>
}

export function CharacterCard({ full = false }: { full?: boolean }) {
  const data = useData()
  const profile = progressionView({ ...data.progression[0], totalXp: earnedXp(data.xpRewards) })
  return <Card className={`character-card ${full ? 'character-full' : ''}`}><div className="character-ornament" aria-hidden="true"><div className="crest-ring crest-outer" /><div className="crest-ring crest-middle" /><div className="crest-ring crest-inner" /><Shield size={69} strokeWidth={0.85} /><span className="crest-star">✦</span></div><div className="character-top"><span className="card-eyebrow"><span className="tiny-gold-dot" />VOTRE PERSONNAGE</span><Badge tone="purple">Niveau {String(profile.level).padStart(2, '0')}</Badge></div><div className="character-info"><span className="character-title">{profile.title}</span><h2>{data.settings[0].displayName}</h2><p>Votre histoire commence par un premier pas.</p><span className="character-rank"><Sparkles size={13} />{profile.rank.title}</span></div><div className="character-progress"><div><span>Expérience totale</span><strong>{profile.totalXp.toLocaleString('fr-FR')} <small>XP</small></strong></div><Progress value={profile.levelXp} max={profile.levelSpan} label={`${profile.totalXp} points d’expérience. ${Math.round(profile.percent)} % du niveau ${profile.level}.`} /><div className="progress-caption"><span>{profile.remainingXp} XP avant le niveau {profile.level + 1}</span>{!full ? <Link to="/personnage">Voir mon personnage<ArrowRight size={13} /></Link> : <span>{Math.floor(profile.percent)} % du niveau</span>}</div></div></Card>
}

export function WeekCard({ expanded = false }: { expanded?: boolean }) {
  const data = useData()
  const today = useLocalDay()
  const days = currentWeek(new Date(`${today}T12:00:00`))
  const week = data.weeks.find(row => row.startDate === days[0].key)
  const sessions = week?.snapshot ?? []
  const progress = weekProgress(week, data.trainingChecks)
  const labels = ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM']
  return <Card className={`week-card ${expanded ? 'week-expanded' : ''}`}><SectionHeading icon={CalendarDays} title="Votre semaine" to={expanded ? undefined : '/programme'} label="Programme">{expanded && <Badge>{sessions.length} séance{sessions.length > 1 ? 's' : ''}</Badge>}</SectionHeading><div className="week-date"><span>{weekLabel()}</span><Badge tone="neutral">Cette semaine</Badge></div><div className="week-days">{days.map((day, index) => {
    const planned = sessions.filter(session => session.weekday === day.weekday)
    const completed = planned.length > 0 && planned.every(session => sessionProgress(session, data.trainingChecks).status === 'completed')
    return <div key={day.key} className={`week-day ${day.today ? 'day-today' : ''} ${completed ? 'day-done' : ''}`} aria-label={`${labels[index]} ${day.date.getDate()}${day.today ? ', aujourd’hui' : ''}, ${planned.length} séance(s)`}><span>{labels[index]}</span><strong>{day.date.getDate()}</strong><span className="day-marker">{completed ? <Check size={12} /> : planned.length > 0 ? <Circle size={7} fill="currentColor" /> : <span />}</span>{expanded && <div className="day-sessions">{planned.length ? planned.map(session => <div key={session.id}>{session.name}</div>) : <span>Aucune séance</span>}</div>}</div>
  })}</div><div className="week-summary"><span className="week-summary-icon"><CalendarDays size={17} strokeWidth={1.5} /></span><div><strong>{sessions.length ? `${progress.done} / ${progress.total} séances terminées` : week ? 'Une semaine au repos' : 'Une semaine à construire'}</strong><span>{week?.programName ?? 'Créez et sélectionnez votre premier programme.'}</span></div>{sessions.length > 0 && <Badge tone="green">{Math.round(progress.done / progress.total * 100)} %</Badge>}</div></Card>
}

export function MetricCard({ icon: Icon, label, value, unit, detail, tone = 'neutral' }: { icon: LucideIcon; label: string; value: string | number; unit?: string; detail: string; tone?: 'neutral' | 'purple' | 'gold' | 'green' }) {
  return <Card className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><Icon size={18} strokeWidth={1.5} /></div><div className="metric-value">{value}<span>{unit}</span></div><p>{detail}</p></Card>
}

export function FutureNote({ children }: { children: React.ReactNode }) {
  return <div className="future-note"><span className="note-line" /><span>{children}</span><Badge>À venir</Badge></div>
}
