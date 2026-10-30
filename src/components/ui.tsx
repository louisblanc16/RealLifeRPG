import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { Check, CheckCircle2, Info, LoaderCircle, X, type LucideIcon } from 'lucide-react'

export function Button({ variant = 'primary', className = '', busy = false, children, disabled, type = 'button', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; busy?: boolean }) {
  return <button type={type} title={props.title ?? props['aria-label']} className={`button button-${variant} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined} {...props}>{busy && <LoaderCircle size={16} className="spin" />}{children}</button>
}

export function Card({ className = '', ...props }: HTMLAttributes<HTMLElement>) {
  return <section className={`card ${className}`} {...props} />
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'purple' | 'gold' | 'green'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Input({ label, hint, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const generatedId = useId()
  const id = props.id ?? generatedId
  return <div className="field"><label htmlFor={id}>{label}</label><input {...props} data-autofocus={props.autoFocus || undefined} id={id} className="input" aria-invalid={!!error} aria-describedby={hint || error ? `${id}-hint` : undefined} />{(hint || error) && <p id={`${id}-hint`} className={error ? 'field-error' : 'field-hint'}>{error || hint}</p>}</div>
}

export function Progress({ value, max, label }: { value: number; max: number | null; label: string }) {
  const percent = max && max > 0 ? Math.min(100, Math.max(0, value / max * 100)) : 0
  return <div className="progress" role={max ? 'progressbar' : 'img'} aria-label={label} aria-valuenow={max ? value : undefined} aria-valuemin={max ? 0 : undefined} aria-valuemax={max ?? undefined}><span style={{ width: `${percent}%` }} /></div>
}

export function EmptyState({ icon: Icon, title, description, children, compact = false }: { icon: LucideIcon; title: string; description: string; children?: ReactNode; compact?: boolean }) {
  return <div className={`empty-state ${compact ? 'empty-compact' : ''}`}><span className="empty-icon"><Icon size={23} strokeWidth={1.3} /></span><h3>{title}</h3><p>{description}</p>{children}</div>
}

export function Modal({ open, onClose, title, description, children, wide = false }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null)
  const id = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog || !open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    dialog.showModal()
    dialog.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true })
    return () => { dialog.close(); if (previouslyFocused?.isConnected) previouslyFocused.focus({ preventScroll: true }) }
  }, [open])
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} aria-labelledby={id} aria-describedby={description ? `${id}-description` : undefined} onCancel={event => { event.preventDefault(); onClose() }} onClick={event => { if (event.target === event.currentTarget) { const bounds = event.currentTarget.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose() } }}><div className="modal-header"><div><h2 id={id}>{title}</h2>{description && <p id={`${id}-description`}>{description}</p>}</div><Button variant="ghost" className="icon-button" onClick={onClose} aria-label="Fermer"><X size={20} /></Button></div>{children}</dialog>
}

export function ConfirmDialog({ open, title, description, confirmLabel, busy, onCancel, onConfirm, info = 'Une sauvegarde de vos données actuelles sera téléchargée avant l’import. Conservez-la pour pouvoir revenir à cet état.', danger = false }: { open: boolean; title: string; description: string; confirmLabel: string; busy?: boolean; onCancel: () => void; onConfirm: () => void; info?: string; danger?: boolean }) {
  return <Modal open={open} onClose={() => { if (!busy) onCancel() }} title={title} description={description}><div className="dialog-info"><Info size={19} /><p>{info}</p></div><div className="modal-actions"><Button variant="secondary" disabled={busy} onClick={onCancel}>Annuler</Button><Button variant={danger ? 'danger' : 'primary'} busy={busy} onClick={onConfirm}><Check size={16} />{confirmLabel}</Button></div></Modal>
}

export function Select({ label, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const id = useId()
  return <div className="field"><label htmlFor={id}>{label}</label><select {...props} id={id} className="input">{children}</select></div>
}
export function Textarea({ label, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId()
  return <div className="field"><label htmlFor={id}>{label}</label><textarea {...props} id={id} className="input" /></div>
}

type Toast = { id: number; message: string; tone: 'success' | 'error' }
const ToastContext = createContext<(message: string, tone?: Toast['tone']) => void>(() => {})
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const notify = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(current => [...current.slice(-2), { id, message, tone }])
    timers.current.push(setTimeout(() => setToasts(current => current.filter(toast => toast.id !== id)), 6500))
  }, [])
  return <ToastContext.Provider value={notify}>{children}<div className="toast-region" aria-live="polite" aria-atomic="false">{toasts.map(toast => <div key={toast.id} className={`toast toast-${toast.tone}`} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.tone === 'success' ? <CheckCircle2 size={19} /> : <Info size={19} />}<span>{toast.message}</span><Button variant="ghost" className="icon-button" onClick={() => setToasts(current => current.filter(item => item.id !== toast.id))} aria-label="Masquer la notification"><X size={16} /></Button></div>)}</div></ToastContext.Provider>
}
