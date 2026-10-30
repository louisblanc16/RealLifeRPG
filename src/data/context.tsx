/// <reference types="vite/client" />
import { createContext, useContext, useEffect, useState, type Context, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { readSnapshot } from './repository'
import type { Snapshot } from '../domain/models'
import { localDate } from '../domain/dates'
import { refreshGame } from './rpgRepository'
import { lifecycleSource } from './db'

const DataContext = (import.meta.hot?.data.dataContext as Context<Snapshot | null> | undefined) ?? createContext<Snapshot | null>(null)
const DayContext = (import.meta.hot?.data.dayContext as Context<string> | undefined) ?? createContext(localDate(new Date()))
if (import.meta.hot) { import.meta.hot.data.dataContext = DataContext; import.meta.hot.data.dayContext = DayContext }
export const useLocalDay = () => useContext(DayContext)

export function DataProvider({ children }: { children: ReactNode }) {
  const [day, setDay] = useState(localDate(new Date()))
  const [calendarError, setCalendarError] = useState('')
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('real-life-rpg-lifecycle')
    channel.onmessage = event => { if (event.data?.type === 'reset' && event.data.source !== lifecycleSource) window.location.replace('/') }
    return () => channel.close()
  }, [])
  useEffect(() => {
    const refresh = () => setDay(localDate(new Date()))
    const interval = setInterval(refresh, 15_000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => { clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  useEffect(() => { refreshGame().catch(error => setCalendarError(error instanceof Error ? error.message : 'Calendrier indisponible.')) }, [day])
  const result = useLiveQuery(async () => {
    try { return { data: await readSnapshot(), error: null } }
    catch (error) { return { data: null, error: error instanceof Error ? error.message : 'Stockage local indisponible.' } }
  }, [])
  if (result?.error || calendarError) throw new Error(result?.error ?? calendarError)
  if (!result?.data || !result.data.settings.length || !result.data.progression.length) return <div className="boot-screen" role="status"><div className="brand-emblem">R</div><p>Ouverture de votre aventure…</p></div>
  return <DayContext.Provider value={day}><DataContext.Provider value={result.data}>{children}</DataContext.Provider></DayContext.Provider>
}

export function useData() {
  const data = useContext(DataContext)
  if (!data) throw new Error('Les données ne sont pas encore disponibles.')
  return data
}
