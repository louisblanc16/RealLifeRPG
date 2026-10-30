import { LockKeyhole, Sparkles, Zap } from 'lucide-react'
import { Badge, Card } from './ui'
import { useData, useLocalDay } from '../data/context'
import { weeklyXpView } from '../domain/xp'
import { lockLabel } from '../domain/dates'
import type { Records } from '../domain/models'

export function RpgWeekSummary({ week }: { week: Records['weeks'] | undefined }) {
  const data = useData(); useLocalDay()
  const view = weeklyXpView(data, week)
  return <Card className="rpg-week-summary"><div className="rpg-summary-title"><Zap size={18} /><h2>Votre semaine en XP</h2><Badge tone={view.finalized ? 'gold' : 'purple'}>{view.finalized ? 'Définitive' : 'En cours'}</Badge></div><div className="rpg-summary-values"><div><span>XP de base acquis</span><strong>{view.baseXp} <small>XP</small></strong><p>{view.rewardedSessions} / 7 séances récompensées + défis confirmés</p></div><div><span>Bonus {view.finalized ? 'définitif' : 'réussi · provisoire'}</span><strong>{view.bonusXp} <small>XP · {view.successfulPercent} %</small></strong><p>{view.finalized ? 'Historique figé' : 'Ajouté à la progression au verrouillage'}</p></div>{!view.finalized && <div><span>Bonus potentiel</span><strong>{view.potentialBonusXp} <small>XP · jusqu’à {view.possiblePercent} %</small></strong><p>Estimation sur l’XP de base acquis</p></div>}</div><p className="rpg-summary-note">{view.finalized ? <LockKeyhole size={13} /> : <Sparkles size={13} />}{view.finalized ? 'Semaine verrouillée. Les récompenses sont définitives.' : week ? `Bonus additifs, arrondis une seule fois. Finalisation après le ${lockLabel(week.startDate)}.` : 'Les récompenses apparaîtront après vos premières actions.'}</p></Card>
}
