/// <reference types="vite/client" />
import { Component, StrictMode, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter, Link, Route, Routes } from 'react-router-dom'
import { isTauri } from '@tauri-apps/api/core'
import { Database, MapPin } from 'lucide-react'
import '@fontsource-variable/inter'
import './styles.css'
import { initializeDatabase } from './data/db'
import { DataProvider } from './data/context'
import { AppLayout } from './components/navigation'
import { Button, EmptyState, ToastProvider } from './components/ui'
import Dashboard from './features/dashboard/Dashboard'
import Programme from './features/programme/Programme'
import Statistiques from './features/statistiques/Statistiques'
import Defis from './features/defis/Defis'
import Engagements from './features/engagements/Engagements'
import Personnage from './features/personnage/Personnage'

// Desktop URLs stay on the same local document even after navigation/reload.
const Router = isTauri() ? HashRouter : BrowserRouter

function StorageError({ message }: { message: string }) {
  return <div className="boot-screen"><EmptyState icon={Database} title="Votre espace n’a pas pu s’ouvrir." description="Le navigateur doit autoriser le stockage IndexedDB. Vérifiez ses réglages, puis réessayez. Vos données existantes sont conservées." /><p className="field-error">{message}</p><Button onClick={() => window.location.reload()}>Réessayer</Button></div>
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(error: Error) { return { error: error.message } }
  componentDidCatch(_error: Error, _info: ErrorInfo) { /* Preserve storage; never reset after an error. */ }
  render() { return this.state.error ? <StorageError message={this.state.error} /> : this.props.children }
}

function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => { let active = true; initializeDatabase().then(() => { if (active) setReady(true) }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Stockage indisponible.') }); return () => { active = false } }, [])
  if (error) return <StorageError message={error} />
  if (!ready) return <div className="boot-screen"><div className="brand-emblem">R</div><p>Préparation de votre espace…</p></div>
  return <DataProvider><ToastProvider><Router><Routes><Route element={<AppLayout />}><Route index element={<Dashboard />} /><Route path="programme" element={<Programme />} /><Route path="statistiques" element={<Statistiques />} /><Route path="defis" element={<Defis />} /><Route path="engagements" element={<Engagements />} /><Route path="personnage" element={<Personnage />} /><Route path="*" element={<EmptyState icon={MapPin} title="Vous avez quitté le chemin." description="Cette page n’existe pas dans votre espace."><Link className="button button-primary" to="/">Revenir au tableau de bord</Link></EmptyState>} /></Route></Routes></Router></ToastProvider></DataProvider>
}

const root = (import.meta.hot?.data.root as ReturnType<typeof createRoot> | undefined) ?? createRoot(document.getElementById('root')!)
if (import.meta.hot) import.meta.hot.data.root = root
root.render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>)
