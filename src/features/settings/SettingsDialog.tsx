import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import { Database, Download, FileJson, FolderInput, LockKeyhole, Save, Trash2, Upload } from 'lucide-react'
import { Badge, Button, ConfirmDialog, Input, Modal, useToast } from '../../components/ui'
import { useData } from '../../data/context'
import { downloadBackup, exportBackup, importBackup, parseBackup, previewImport, type Backup } from '../../data/backup'
import { readSnapshot, saveDisplayName, tableLabels } from '../../data/repository'
import { SCHEMA_VERSION, tableNames, type Snapshot } from '../../domain/models'
import { RESET_PHRASE, resetAllData } from '../../data/db'

import { AppearanceSettings } from './AppearanceSettings'

type ImportPreview = { backup: Backup; current: Snapshot; fresh: boolean; count: number; fileName: string }

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const desktop = isTauri()
  const data = useData()
  const [name, setName] = useState(data.settings[0].displayName)
  const [busy, setBusy] = useState(false)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [error, setError] = useState('')
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0)
  const [resetPhrase, setResetPhrase] = useState('')
  const [resetError, setResetError] = useState('')
  function cancelReset() { if (!busy) { setResetStep(0); setResetPhrase(''); setResetError('') } }
  const input = useRef<HTMLInputElement>(null)
  const toast = useToast()
  useEffect(() => { if (open) { setName(data.settings[0].displayName); setError(''); setPreview(null) } }, [open, data.settings[0].displayName])
  const fail = (err: unknown) => { const message = err instanceof Error ? err.message : 'Cette opération n’a pas pu aboutir.'; setError(message); toast(message, 'error') }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try { await saveDisplayName(name); toast('Votre nom a été enregistré.') } catch (err) { fail(err) } finally { setBusy(false) }
  }
  async function handleExport() {
    setBusy(true); setError('')
    try { if (await exportBackup()) toast('Sauvegarde JSON enregistrée.') } catch (err) { fail(err) } finally { setBusy(false) }
  }
  async function inspect(file?: File) {
    if (!file) return
    setBusy(true); setPreview(null); setError('')
    try { const backup = await parseBackup(file); const current = await readSnapshot(); const result = previewImport(current, backup.data); setPreview({ backup, current, ...result, fileName: file.name }) } catch (err) { fail(err) } finally { setBusy(false); if (input.current) input.current.value = '' }
  }
  async function handleImport() {
    if (!preview) return
    setBusy(true); setError('')
    try {
      if (!await downloadBackup(preview.current, 'real-life-rpg-avant-import')) return
      await importBackup(preview.backup, preview.current)
      setConfirm(false); setPreview(null); toast('Sauvegarde importée. Vos données sont disponibles.')
    } catch (err) { setConfirm(false); fail(err) } finally { setBusy(false) }
  }
  async function handleReset(event: FormEvent) {
    event.preventDefault()
    if (busy || resetStep !== 2 || resetPhrase !== RESET_PHRASE) return
    setBusy(true); setResetError('')
    try {
      await resetAllData({ acknowledged: resetStep === 2, phrase: resetPhrase })
      window.location.replace('/')
    } catch (err) { setResetError(err instanceof Error ? err.message : 'La réinitialisation a échoué. Vos données ont été conservées.'); setBusy(false) }
  }
  return <><Modal open={open} onClose={() => { if (!busy) onClose() }} title="Votre espace personnel" description="Vos préférences. Vos données. Votre contrôle." wide><div className="settings-content"><form onSubmit={save}><h3 className="settings-heading">PROFIL</h3><div className="settings-profile"><Input label="Nom du personnage" value={name} onChange={event => setName(event.target.value)} maxLength={120} required autoComplete="nickname" /><Button variant="secondary" type="submit" disabled={name.trim() === data.settings[0].displayName || !name.trim()} busy={busy}><Save size={16} />Enregistrer</Button></div></form>
    <AppearanceSettings disabled={busy} /><div className="settings-section"><div className="section-heading"><h3><Database size={17} />Données & sauvegardes</h3><Badge tone="green">Local</Badge></div><p className="settings-description">{desktop ? 'Les données restent dans votre profil système, sur cet appareil. Exportez une copie JSON pour les conserver ou les transférer depuis la version web.' : 'Les données restent dans ce navigateur, à cette adresse. Exportez régulièrement une copie pour les conserver ou les transférer.'}</p><div className="backup-actions"><button className="backup-action" disabled={busy} onClick={handleExport}><span className="action-symbol"><Download size={20} /></span><strong>Exporter mes données</strong><span>Sauvegarde JSON · format v1</span><FileJson size={17} /></button><button className="backup-action" disabled={busy} onClick={() => input.current?.click()}><span className="action-symbol"><Upload size={20} /></span><strong>Importer une sauvegarde</strong><span>Vérification avant toute écriture</span><FolderInput size={17} /></button></div><input ref={input} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-label="Choisir une sauvegarde JSON" onChange={event => void inspect(event.target.files?.[0])} />
    {preview && <div className="import-preview"><div><FileJson size={20} /><strong>Fichier vérifié</strong><Badge tone="green">Compatible</Badge></div><p className="truncate">{preview.fileName}</p><p>{preview.count} enregistrements · export du {new Date(preview.backup.exportedAt).toLocaleDateString('fr-FR')}</p><p>{preview.fresh ? 'Le profil initial vierge sera remplacé par celui de la sauvegarde.' : 'Fusion sans écrasement. Les enregistrements déjà présents seront conservés.'}</p><Button busy={busy} onClick={() => setConfirm(true)}><Upload size={16} />Continuer l’import</Button></div>}
    {error && <p className="inline-error" role="alert">{error}</p>}
    <details className="storage-details"><summary>Contenu du stockage local <span>{tableNames.reduce((sum, table) => sum + data[table].length, 0)} enregistrements</span></summary><dl>{tableNames.map(table => <div key={table}><dt>{tableLabels[table]}</dt><dd>{data[table].length}</dd></div>)}</dl></details></div>
    <div className="privacy-note"><LockKeyhole size={17} /><span>Aucun compte. Aucun serveur. Aucune donnée transmise.<small>Schéma IndexedDB v{SCHEMA_VERSION} · Semaines du lundi au dimanche.</small></span></div>
    <section className="reset-zone" aria-labelledby="reset-heading"><div><h3 id="reset-heading">Repartir de zéro</h3><p>Supprime définitivement votre personnage et toutes vos données locales. Exportez une sauvegarde au préalable si vous souhaitez les conserver.</p></div><Button variant="danger" disabled={busy} onClick={() => { setResetPhrase(''); setResetError(''); setResetStep(1) }}><Trash2 size={16} />Réinitialiser toutes mes données</Button></section></div></Modal>
    <ConfirmDialog open={confirm} title="Importer cette sauvegarde ?" description={preview?.fresh ? 'Cette installation est vierge : le profil initial sera remplacé par votre sauvegarde.' : 'Les données seront fusionnées. Tout conflit d’identifiant annulera l’opération complète.'} confirmLabel="Sauvegarder et importer" busy={busy} onCancel={() => setConfirm(false)} onConfirm={() => void handleImport()} />
    <ConfirmDialog open={resetStep === 1} title="Réinitialiser toutes vos données ?" description="Première confirmation · cette suppression est définitive." info="Personnage, XP, niveaux, programmes, séances, historiques, mesures, défis, engagements et diète seront effacés. Vous devrez ensuite saisir RÉINITIALISER pour confirmer une seconde fois. Aucun export automatique ne sera créé." confirmLabel="Je comprends, continuer" danger onCancel={cancelReset} onConfirm={() => setResetStep(2)} />
    <Modal open={resetStep === 2} onClose={cancelReset} title="Confirmer la suppression définitive" description="Seconde confirmation · l’application reviendra à son état de première utilisation."><form onSubmit={handleReset}><fieldset className="editor-body" disabled={busy}><Input label="Saisissez RÉINITIALISER pour confirmer" value={resetPhrase} onChange={event => setResetPhrase(event.target.value)} autoComplete="off" autoFocus spellCheck={false} hint="Le mot doit être saisi exactement, en majuscules et avec l’accent." /><p className="reset-final-warning">{desktop ? 'Toutes les données de cette application de bureau, pour votre utilisateur système, seront supprimées. Vos autres navigateurs et comptes système ne sont pas affectés. Cette action est irréversible.' : 'Toutes les données personnelles de cette application, dans ce navigateur et à cette adresse, seront supprimées. Cette action est irréversible.'}</p>{resetError && <p className="inline-error" role="alert">{resetError}</p>}</fieldset><div className="editor-footer"><Button type="button" variant="secondary" disabled={busy} onClick={cancelReset}>Annuler</Button><Button type="submit" variant="danger" busy={busy} disabled={resetPhrase !== RESET_PHRASE}><Trash2 size={16} />Supprimer définitivement</Button></div></form></Modal></>
}
