import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Check, Flame, Trophy } from 'lucide-react'
import { useData, useLocalDay } from '../data/context'
import { calculateDiscipline } from '../domain/discipline'
import { Badge, Card, Progress } from './ui'

export function useDiscipline() {
  const data = useData(), today = useLocalDay()
  return useMemo(() => calculateDiscipline(data, today), [data, today])
}

const reasons = {
  complete: 'Diète respectée et toutes les séances terminées.',
  dietMissing: 'Configurez votre diète pour commencer votre série.',
  dietNotRequired: 'Pour une série continue, votre diète doit être requise chaque jour.',
  dietFailed: 'La journée reste ouverte : vous pouvez encore corriger votre suivi.',
  dietUnreported: 'Votre diète attend sa validation.',
  training: 'Terminez toutes les séances prévues pour valider la journée.',
}

export function DisciplinePanel() {
  const streak = useDiscipline()
  return <Card className="discipline-panel"><div className="discipline-heading"><span><Flame size={18} />Discipline Streak</span><Badge tone={streak.today.status === 'succeeded' ? 'green' : 'neutral'}>{streak.today.status === 'succeeded' ? 'Jour réussi' : 'En attente'}</Badge></div>
    <div className="streak-number"><Flame size={44} strokeWidth={1.25} /><strong>{streak.current}</strong><span>{streak.current === 1 ? 'jour' : 'jours'}</span></div>
    <div className={`aura-label aura-label-${streak.aura.color}`}><span />{streak.aura.name}</div>
    <div className="aura-progress"><div><span>{streak.nextAura ? `Prochain palier · ${streak.nextAura.name}` : 'Palier Immortel atteint'}</span><strong>{streak.nextAura ? `${streak.current} / ${streak.nextAura.min} j` : `${streak.current} j`}</strong></div><Progress value={streak.nextAura ? streak.current - streak.aura.min : 1} max={streak.nextAura ? streak.nextAura.min - streak.aura.min : 1} label={streak.nextAura ? `Encore ${streak.nextAura.min - streak.current} jours avant ${streak.nextAura.name}` : 'Dernier palier d’aura atteint'} /></div>
    <div className="discipline-days" aria-label="Derniers jours suivis">{streak.days.slice(-7).map(day => <span key={day.date} className={`discipline-day-${day.status}`} title={`${day.date} · ${day.status === 'succeeded' ? 'Réussi' : day.status === 'failed' ? 'Incomplet' : 'En attente'}`}><small>{new Date(`${day.date}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'narrow' })}</small><i>{day.status === 'succeeded' ? <Check size={14} /> : new Date(`${day.date}T12:00:00`).getDate()}</i></span>)}</div>
    <p className="discipline-hint">{reasons[streak.today.reason]}</p><div className="discipline-record-line"><span><Trophy size={14} />Record : <strong>{streak.best} jours</strong></span><Link to="/personnage">Mon aura<ArrowUpRight size={14} /></Link></div>
    <p className="discipline-rule">Diète + séances prévues. Les engagements restent liés à leurs bonus d’XP. Les corrections autorisées recalculent la série.</p>
  </Card>
}

export function DisciplineRecord() {
  const streak = useDiscipline()
  return <Card className="discipline-record"><span className="discipline-record-icon"><Flame size={22} /></span><div><h2>Discipline Streak</h2><p>Calculé depuis votre historique · indépendant de l’XP</p></div><div><span>Actuel</span><strong>{streak.current} <small>jours</small></strong></div><div><span>Record historique</span><strong>{streak.best} <small>jours</small></strong></div></Card>
}
