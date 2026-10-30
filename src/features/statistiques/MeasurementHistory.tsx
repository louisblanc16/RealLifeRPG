import { useState } from 'react'
import { Edit3, History, Trash2 } from 'lucide-react'
import { Badge, Button, Card, ConfirmDialog, EmptyState, useToast } from '../../components/ui'
import { SectionHeading } from '../../components/overview'
import type { Records } from '../../domain/models'
import { formatValue, orderedMeasures } from '../../domain/statistics'
import { deleteMeasurement } from '../../data/statisticsRepository'

export function MeasurementHistory({ definition, measurements, onEdit }: { definition: Records['statisticDefinitions']; measurements: Records['measurements'][]; onEdit: (row: Records['measurements']) => void }) {
  const [deleted, setDeleted] = useState<Records['measurements'] | null>(null), [busy, setBusy] = useState(false), toast = useToast()
  const ordered = orderedMeasures(measurements)
  return <><Card className="module-panel records-card"><SectionHeading icon={History} title="Historique des mesures"><Badge>{ordered.length}</Badge></SectionHeading>{ordered.length ? <div className="measurement-history"><table><thead><tr><th>Date</th><th>Valeur</th><th>Variation</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{[...ordered].reverse().map((row, index) => {
    const previous = ordered[ordered.length - index - 2], delta = previous ? row.value - previous.value : null
    return <tr key={row.id}><td data-label="Date"><strong>{new Date(row.measuredAt).toLocaleDateString('fr-FR')}</strong>{row.notes && <small>{row.notes}</small>}</td><td data-label="Valeur">{formatValue(row.value)} <span>{definition.unit}</span></td><td data-label="Variation" className="neutral-variation">{delta === null ? '—' : `${delta > 0 ? '+' : ''}${formatValue(delta)} ${definition.unit}`}</td><td className="measurement-actions"><div className="row-actions"><Button variant="ghost" className="icon-button" aria-label="Modifier cette mesure" onClick={() => onEdit(row)}><Edit3 size={15} /></Button><Button variant="ghost" className="icon-button delete-action" aria-label="Supprimer cette mesure" onClick={() => setDeleted(row)}><Trash2 size={15} /></Button></div></td></tr>
  })}</tbody></table></div> : <EmptyState compact icon={History} title="Votre première mesure vous attend." description="Chaque relevé daté sera conservé et restera modifiable." />}</Card><ConfirmDialog open={!!deleted} title="Supprimer cette mesure ?" description={deleted ? `${formatValue(deleted.value)} ${definition.unit} · ${new Date(deleted.measuredAt).toLocaleDateString('fr-FR')}` : ''} info="Cette mesure sera supprimée. Les graphiques et records seront recalculés depuis l’historique restant." danger confirmLabel="Supprimer la mesure" busy={busy} onCancel={() => setDeleted(null)} onConfirm={async () => { if (!deleted) return; setBusy(true); try { await deleteMeasurement(deleted.id, deleted.updatedAt); setDeleted(null); toast('Mesure supprimée.') } catch (err) { toast(err instanceof Error ? err.message : 'Suppression impossible.', 'error') } finally { setBusy(false) } }} /></>
}
