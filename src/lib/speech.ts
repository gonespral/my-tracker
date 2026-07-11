import { useRef } from 'react'
import { useAppStore } from '../store'
import { showToast } from './toast'

interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: { transcript: string }
}
interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
}

export function useSpeechInput(onTranscript: (text: string, isFinal: boolean) => void) {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const finalHandledRef = useRef(false)

  function ensureRecognition() {
    if (recognitionRef.current) return recognitionRef.current
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return null
    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'
    recognition.onresult = (e) => {
      const transcript = Array.from(e.results).map((r) => r[0].transcript).join('')
      const isFinal = e.results[e.results.length - 1]?.isFinal
      onTranscript(transcript, !!isFinal)
      if (isFinal && !finalHandledRef.current) {
        finalHandledRef.current = true
        stop()
      }
    }
    recognition.onerror = () => stop()
    recognition.onend = () => { if (useAppStore.getState().listening) stop() }
    recognitionRef.current = recognition
    return recognition
  }

  function start() {
    const recognition = ensureRecognition()
    if (!recognition) {
      showToast('Speech recognition not supported in this browser')
      return
    }
    finalHandledRef.current = false
    useAppStore.setState({ listening: true })
    try { recognition.start() } catch { /* already started */ }
  }

  function stop() {
    useAppStore.setState({ listening: false })
    try { recognitionRef.current?.stop() } catch { /* not started */ }
  }

  return { start, stop }
}
