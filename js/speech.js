import { state } from './state.js'
import { showToast } from './ui.js'

export function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SR) return false
  state.recognition = new SR()
  state.recognition.continuous     = false
  state.recognition.interimResults  = true
  state.recognition.lang            = 'en-US'
  state.recognition.onresult = (e) => {
    const transcript = Array.from(e.results).map(r => r[0].transcript).join('')
    const inp = document.getElementById('main-input')
    inp.value = transcript
    inp.style.height = 'auto'
    inp.style.height = Math.min(inp.scrollHeight, window.innerHeight * 0.45) + 'px'
    if (e.results[e.results.length - 1].isFinal && !state.speechHandled) {
      state.speechHandled = true
      stopListening()
      inp.dispatchEvent(new Event('submit-input'))
    }
  }
  state.recognition.onerror = () => stopListening()
  state.recognition.onend   = () => { if (state.listening) stopListening() }
  return true
}

export function startListening() {
  if (!state.recognition && !initSpeech()) {
    showToast('Speech recognition not supported in this browser')
    return
  }
  state.listening     = true
  state.speechHandled = false
  document.getElementById('mic-btn').classList.add('listening')
  document.getElementById('main-input').placeholder = 'Listening…'
  try { state.recognition.start() } catch {}
}

export function stopListening() {
  state.listening = false
  document.getElementById('mic-btn').classList.remove('listening')
  document.getElementById('main-input').placeholder = 'Type something…'
  try { state.recognition.stop() } catch {}
}
