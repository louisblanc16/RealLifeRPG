import { useEffect, useRef } from 'react'
import { useData } from '../data/context'
import { calculateProgression } from '../domain/progression'
import { earnedXp } from '../domain/xp'
import { useToast } from './ui'

export function ProgressionNotice() {
  const data = useData(), toast = useToast(), profile = calculateProgression(earnedXp(data.xpRewards))
  const previous = useRef({ level: profile.level, rank: profile.rank.title })
  useEffect(() => {
    if (profile.level > previous.current.level) toast(profile.rank.title !== previous.current.rank ? `Niveau ${profile.level} · nouveau rang : ${profile.rank.title}.` : `Niveau ${profile.level} atteint. Votre progression continue.`)
    previous.current = { level: profile.level, rank: profile.rank.title }
  }, [profile.level, profile.rank.title, toast])
  return null
}
