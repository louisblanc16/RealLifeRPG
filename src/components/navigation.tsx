import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { ArrowUpRight, ChevronRight, Dumbbell, Hexagon, LayoutDashboard, Leaf, LockKeyhole, Menu, Settings2, Shield, Sparkles, TrendingUp, Trophy, X } from 'lucide-react'
import { useData, useLocalDay } from '../data/context'
import { Button } from './ui'
import { SettingsDialog } from '../features/settings/SettingsDialog'
import { ProgressionNotice } from './ProgressionNotice'
import { eligibleChallenges } from '../domain/xp'
import { ThemeSync } from './ThemeSync'

export const navigation = [
  { to: '/', label: 'Tableau de bord', short: 'Accueil', icon: LayoutDashboard, index: '01' },
  { to: '/programme', label: 'Programme', short: 'Programme', icon: Dumbbell, index: '02' },
  { to: '/statistiques', label: 'Statistiques', short: 'Statistiques', icon: TrendingUp, index: '03' },
  { to: '/defis', label: 'Défis', short: 'Défis', icon: Trophy, index: '04' },
  { to: '/engagements', label: 'Engagements & Diète', short: 'Engagements', icon: Leaf, index: '05' },
  { to: '/personnage', label: 'Personnage', short: 'Personnage', icon: Shield, index: '06' },
] as const

export function AppLayout() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mobile, setMobile] = useState(() => window.matchMedia('(max-width: 760px)').matches)
  const sidebar = useRef<HTMLElement>(null)
  const firstRoute = useRef(true)
  const location = useLocation()
  const data = useData()
  useLocalDay()
  const profile = data.settings[0]
  const readyCount = eligibleChallenges(data).length
  const current = navigation.find(item => item.to === location.pathname)
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)')
    const update = () => { setMobile(query.matches); setMenuOpen(false) }
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  useEffect(() => {
    setMenuOpen(false); document.title = `${current?.label ?? 'Page introuvable'} — REAL LIFE RPG`
    if (firstRoute.current) { firstRoute.current = false; return }
    window.scrollTo(0, 0)
    const frame = requestAnimationFrame(() => document.getElementById('main-content')?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, current?.label])
  useEffect(() => {
    if (!menuOpen || !mobile) return
    const previousFocus = document.activeElement as HTMLElement | null
    sidebar.current?.querySelector<HTMLElement>('.nav-active')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
      if (event.key === 'Tab') {
        const controls = sidebar.current?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled)')
        const first = controls?.[0], last = controls?.[controls.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }) }
  }, [menuOpen, mobile])
  return <div className="app-shell"><ThemeSync /><a href="#main-content" className="skip-link" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus() }}>Aller au contenu</a>
    {menuOpen && <button className="sidebar-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fermer la navigation" />}
    <aside ref={sidebar} inert={mobile && !menuOpen} aria-hidden={mobile && !menuOpen ? true : undefined} className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} id="main-navigation"><Link to="/" className="brand" aria-label="REAL LIFE RPG, accueil"><span className="brand-emblem"><Hexagon size={31} strokeWidth={1.25} /><span>R</span></span><span>REAL LIFE <b>RPG</b><small>LA PROGRESSION EST RÉELLE.</small></span></Link>
      <Button variant="ghost" className="icon-button sidebar-close" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}><X size={20} /></Button>
      <div className="sidebar-label">VOTRE ESPACE</div><nav aria-label="Navigation principale">{navigation.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => `nav-item ${isActive ? 'nav-active' : ''}`}><Icon size={19} strokeWidth={1.65} /><span>{label}</span>{to === '/defis' && readyCount > 0 && <span className="nav-count" aria-label={`${readyCount} défis prêts à confirmer`}>{readyCount}</span>}<span className="nav-indicator" /></NavLink>)}</nav>
      <div className="sidebar-bottom"><div className="journey-note"><Sparkles size={18} strokeWidth={1.4} /><p>Un peu mieux.<br /><strong>Chaque jour.</strong></p><span>VOTRE AVENTURE, VOTRE RYTHME.</span></div><div className="local-status"><span className="status-dot" />Données stockées en local<LockKeyhole size={12} /></div><button className="profile-button" onClick={() => setSettingsOpen(true)} aria-label="Ouvrir les paramètres du profil"><span className="avatar">{profile.displayName.slice(0, 1).toLocaleUpperCase('fr')}</span><span className="profile-text"><strong>{profile.displayName}</strong><small>Votre espace personnel</small></span><Settings2 size={17} /></button></div>
    </aside>
    <div className="workspace" inert={mobile && menuOpen}><header className="topbar"><div className="breadcrumbs"><Button className="icon-button mobile-menu" variant="ghost" onClick={() => setMenuOpen(value => !value)} aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={menuOpen} aria-controls="main-navigation">{menuOpen ? <X size={21} /> : <Menu size={21} />}</Button><span className="breadcrumb-root">Mon espace</span><ChevronRight size={13} /><span>{current?.label ?? 'Page introuvable'}</span></div><div className="topbar-right"><span className="topbar-date">{new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}</span><span className="topbar-divider" /><span className="private-label"><LockKeyhole size={13} />100 % local</span><Button variant="ghost" className="icon-button topbar-settings" onClick={() => setSettingsOpen(true)} aria-label="Ouvrir les paramètres"><Settings2 size={18} /></Button></div></header>
    <main className="main-content" id="main-content" tabIndex={-1}><Outlet /></main><footer className="app-footer"><span>REAL LIFE RPG <i /> Une progression qui vous appartient.</span><span>Version 1.0 · Local <ArrowUpRight size={12} /></span></footer></div>
    <ProgressionNotice /><SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
  </div>
}
