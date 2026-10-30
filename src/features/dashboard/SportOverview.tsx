import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { Activity, ArrowRight, TrendingUp } from 'lucide-react'
import { Card, EmptyState } from '../../components/ui'
import { SectionHeading } from '../../components/overview'
import { useData } from '../../data/context'
import { formatValue, orderedMeasures, personalRecord } from '../../domain/statistics'

const WeightChart = lazy(() => import('../statistiques/WeightChart'))
export function SportOverview() {
  const data = useData()
  const weight = data.statisticDefinitions.find(d => d.kind === 'weight')
  const measures = orderedMeasures(data.measurements.filter(m => m.definitionId === weight?.id))
  const performances = data.statisticDefinitions.filter(d => d.kind !== 'weight' && data.measurements.some(m => m.definitionId === d.id)).slice(0, 4)
  return <><div className="dashboard-sport-grid"><Card className="module-preview dashboard-weight"><SectionHeading icon={TrendingUp} title="Évolution pondérale" to="/statistiques" label="Historique" />{measures.length ? <Suspense fallback={<p className="form-help">Chargement du graphique…</p>}><WeightChart measurements={measures.slice(-12)} /></Suspense> : <EmptyState compact icon={TrendingUp} title="Le début de votre courbe." description="Enregistrez un premier poids pour suivre son évolution, sans jugement."><Link to="/statistiques" className="text-link">Ajouter une mesure<ArrowRight size={13} /></Link></EmptyState>}</Card><Card className="module-panel"><SectionHeading icon={Activity} title="Vos repères sportifs" to="/statistiques" label="Statistiques" />{performances.length ? <div className="dashboard-performance">{performances.map(def => {
    const rows = orderedMeasures(data.measurements.filter(m => m.definitionId === def.id)), last = rows.at(-1)!, record = personalRecord(def, rows)
    return <div key={def.id}><span>{def.name}</span><strong>{formatValue(last.value)} <small>{def.unit}</small></strong><p>{record ? `Record : ${formatValue(record.value)} ${def.unit}` : 'Suivi neutre'}</p></div>
  })}</div> : <EmptyState compact icon={Activity} title="Des progrès à mesurer." description="Vos dernières performances et vos records apparaîtront après vos premières mesures." />}</Card></div></>
}
