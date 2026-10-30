import { useRef, useState } from 'react'
import { Check, Monitor, Moon, Palette, Sun } from 'lucide-react'
import { useData } from '../../data/context'
import { saveAppearance } from '../../data/repository'
import type { Settings } from '../../domain/models'
import { useToast } from '../../components/ui'

const themes = [{ value: 'dark', label: 'Sombre', icon: Moon }, { value: 'light', label: 'Clair', icon: Sun }, { value: 'system', label: 'Système', icon: Monitor }] as const
const accents = [{ value: 'violet', label: 'Violet' }, { value: 'blue', label: 'Bleu' }, { value: 'red', label: 'Rouge' }, { value: 'emerald', label: 'Vert émeraude' }, { value: 'orange', label: 'Orange' }] as const

export function AppearanceSettings({ disabled }: { disabled: boolean }) {
  const profile = useData().settings[0], toast = useToast(), pending = useRef(false)
  const [busy, setBusy] = useState(false)
  async function update(patch: Partial<Pick<Settings, 'theme' | 'accent'>>) {
    if (pending.current || disabled) return
    pending.current = true; setBusy(true)
    try { await saveAppearance({ theme: profile.theme, accent: profile.accent, ...patch }) }
    catch (error) { toast(error instanceof Error ? error.message : 'Préférence non enregistrée.', 'error') }
    finally { pending.current = false; setBusy(false) }
  }
  return <section className="settings-section appearance-settings"><div className="section-heading"><h3><Palette size={17} />Apparence</h3><span className="appearance-saved">Enregistrement automatique</span></div>
    <fieldset disabled={disabled || busy}><legend>Thème</legend><div className="theme-options">{themes.map(({ value, label, icon: Icon }) => <button key={value} type="button" aria-pressed={profile.theme === value} onClick={() => void update({ theme: value })}><Icon size={20} /><span>{label}</span>{profile.theme === value && <Check size={14} />}</button>)}</div><p className="form-help">Le mode Système suit automatiquement le thème de votre appareil.</p></fieldset>
    <fieldset disabled={disabled || busy}><legend>Couleur d’accent</legend><div className="accent-options">{accents.map(({ value, label }) => <button key={value} type="button" aria-pressed={profile.accent === value} className={`accent-option accent-${value}`} onClick={() => void update({ accent: value })}><span className="accent-swatch">{profile.accent === value && <Check size={14} />}</span><span>{label}</span></button>)}</div></fieldset>
  </section>
}
