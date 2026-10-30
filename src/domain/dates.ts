export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Calendar arithmetic avoids UTC and daylight-saving shifts. */
export function currentWeek(now = new Date()) {
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + index)
    return { date, key: localDate(date), today: localDate(date) === localDate(now), weekday: index + 1 }
  })
}

export function weekLabel(now = new Date()) {
  const days = currentWeek(now)
  const format = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' })
  return `${format.format(days[0].date)} — ${format.format(days[6].date)}`
}

export function addDays(key: string, days: number) {
  const date = new Date(`${key}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDate(date)
}

export function weekStart(now = new Date()) { return currentWeek(now)[0].key }
export function weekEditable(start: string, now = new Date()) {
  return now.getTime() < new Date(`${addDays(start, 14)}T00:00:00`).getTime()
}
export function lockLabel(start: string) {
  return new Date(`${addDays(start, 13)}T23:59:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }) + ' à 23 h 59'
}
