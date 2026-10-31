// Read Bible text aloud with the phone's built-in voice (no internet needed
// on iPhone). Uses the Web Speech API.

import { useEffect, useState } from 'react'

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

const listeners = new Set<(speaking: boolean) => void>()
const emit = (on: boolean) => listeners.forEach((l) => l(on))

/** Speak a list of text chunks in order (one per verse keeps long chapters smooth). */
export function speak(chunks: string[], rate = 0.95) {
  if (!speechSupported) return
  stopSpeaking()
  const voice = speechSynthesis.getVoices().find((v) => v.lang.startsWith('en') && v.localService) ?? null
  chunks.forEach((text, i) => {
    const u = new SpeechSynthesisUtterance(text)
    u.rate = rate
    u.lang = 'en-US'
    if (voice) u.voice = voice
    if (i === chunks.length - 1) {
      u.onend = () => emit(false)
    }
    speechSynthesis.speak(u)
  })
  emit(true)
}

export function stopSpeaking() {
  if (!speechSupported) return
  speechSynthesis.cancel()
  emit(false)
}

export function useSpeaking(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    listeners.add(setOn)
    return () => {
      listeners.delete(setOn)
    }
  }, [])
  // Stop reading when leaving the page.
  useEffect(() => () => stopSpeaking(), [])
  return on
}
