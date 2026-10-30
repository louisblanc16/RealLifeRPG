import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ArrowUpRight, CheckCheck, Dumbbell, Flag, Leaf, Scale, Sparkles, Trophy, Zap } from 'lucide-react'
import { Badge, Button, Card, EmptyState } from '../../components/ui'
import { CharacterCard, MetricCard, PageHeading, SectionHeading, WeekCard } from '../../components/overview'
import { useData, useLocalDay } from '../../data/context'
import { currentWeek } from '../../domain/dates'
import { weekProgress } from '../../domain/training'
import { orderedMeasures, variation, formatValue } from '../../domain/statistics'
import { SportOverview } from './SportOverview'
import { RpgWeekSummary } from '../../components/RpgWeekSummary'
import { habitState, weeklyXpView } from '../../domain/xp'
import { DisciplinePanel } from '../../components/DisciplinePanel'
import { DailyActions } from './DailyActions'
import { MeasurementEditor } from '../statistiques/MeasurementEditor'

export default function Dashboard() {
  const data = useData()
  const [weightOpen, setWeightOpen] = useState(false)
  const weightDefinition = data.statisticDefinitions.find(row => row.kind === 'weight')
  useLocalDay()
  const weightIds = new Set(data.statisticDefinitions.filter(row => row.kind === 'weight').map(row => row.id))
  const weights = orderedMeasures(data.measurements.filter(row => weightIds.has(row.definitionId)))
  const weight = weights.at(-1)
  const delta = variation(weights)
  const weekStart = currentWeek()[0].key
  const week = data.weeks.find(row => row.startDate === weekStart)
  const completed = weekProgress(week, data.trainingChecks).done
  const activeChallenges = data.challenges.filter(row => row.status === 'active' || row.status === 'ready')
  const commitments = [...(week?.commitmentSnapshot ?? []), ...(week?.dietSnapshot ? [week.dietSnapshot] : [])]
  const xp = weeklyXpView(data, week)
  const weekXp = xp.baseXp + (xp.finalized ? xp.bonusXp : 0)
  return <div className="page-enter"><PageHeading eyebrow="CHAQUE EFFORT COMPTE" title="Tableau de bord" description="Une vision claire. Des efforts concrets. Votre progression.">{weightDefinition && <Button variant="secondary" onClick={() => setWeightOpen(true)}><Scale size={16} />Ajouter un poids</Button>}</PageHeading>
    <div className="dashboard-primary"><CharacterCard /><WeekCard /></div>
    <div className="dashboard-daily"><DailyActions /><DisciplinePanel /></div>
    <div className="metrics-grid"><MetricCard icon={Scale} label="Dernier poids" value={weight ? weight.value.toLocaleString('fr-FR') : '—'} unit="kg" detail={delta !== null ? `${delta > 0 ? '+' : ''}${formatValue(delta)} kg depuis le relevé précédent` : weight ? `Mesuré le ${new Date(weight.measuredAt).toLocaleDateString('fr-FR')}` : 'Aucune mesure enregistrée'} /><MetricCard icon={Dumbbell} label="Séances terminées" value={completed} unit="séances" detail="Cette semaine" /><MetricCard icon={Flag} label="Défis en cours" value={activeChallenges.length} detail="Des objectifs qui vous ressemblent" tone="gold" /><MetricCard icon={Zap} label="Expérience gagnée" value={weekXp.toLocaleString('fr-FR')} unit="XP" detail="Cette semaine" tone="purple" /></div>
    <RpgWeekSummary week={week} /><SportOverview />
    <div className="dashboard-secondary"><Card className="module-preview"><SectionHeading icon={Trophy} title="Vos défis" to="/defis" label="Explorer" />{activeChallenges.length ? <div className="record-list">{activeChallenges.slice(0, 3).map(row => <Link to="/defis" key={row.id}><span>{row.name}</span><Badge tone="gold">{row.rewardXp} XP</Badge></Link>)}</div> : <EmptyState compact icon={Flag} title="Les grandes aventures ont un objectif." description="Créez vos objectifs personnels et confirmez leurs réalisations."><Link className="text-link" to="/defis">Découvrir l’espace défis<ArrowRight size={14} /></Link></EmptyState>}</Card>
    <Card className="module-preview"><SectionHeading icon={Leaf} title="Vos engagements" to="/engagements" label="Consulter" />{commitments.length ? <div className="record-list">{commitments.slice(0, 4).map(row => <Link to="/engagements" key={row.id}><span>{row.name}</span><Badge tone={week && habitState(row, week, data.dailyChecks).status === 'succeeded' ? 'green' : 'neutral'}>{week ? `${habitState(row, week, data.dailyChecks).done} / ${row.requiredDays.length} jours` : '—'}</Badge></Link>)}</div> : <EmptyState compact icon={CheckCheck} title="La régularité fait la différence." description="Configurez vos engagements quotidiens et votre objectif diète."><Link className="text-link" to="/engagements">Découvrir mes engagements<ArrowRight size={14} /></Link></EmptyState>}</Card></div>
    <div className="journey-banner"><span className="journey-banner-icon"><Sparkles size={22} strokeWidth={1.3} /></span><div><strong>Le vrai niveau supérieur, c’est vous.</strong><p>Construisez une progression durable, à votre rythme.</p></div><Link to="/personnage">L’aventure ne fait que commencer<ArrowUpRight size={17} /></Link></div>
    {weightOpen && weightDefinition && <MeasurementEditor definition={weightDefinition} onClose={() => setWeightOpen(false)} />}
  </div>
}
