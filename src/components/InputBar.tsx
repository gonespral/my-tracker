import { useRef, useState } from 'react'
import { useAppStore } from '../store'
import { sendChatMessage, openChat, isChatLoading, abortChat } from '../lib/ai'
import { useSpeechInput } from '../lib/speech'
import Icon from './Icon'

interface PendingImage { data: string; mediaType: string }

function compressImage(file: File): Promise<PendingImage> {
  const MAX_BYTES = 4.5 * 1024 * 1024
  const MAX_DIM = 1568
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      let { width, height } = img
      if (width > MAX_DIM || height > MAX_DIM) {
        const scale = MAX_DIM / Math.max(width, height)
        width = Math.round(width * scale)
        height = Math.round(height * scale)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const tryQuality = (quality: number) => {
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64 = dataUrl.split(',')[1]
        if (base64.length * 0.75 <= MAX_BYTES || quality <= 0.1) {
          resolve({ data: base64, mediaType: 'image/jpeg' })
        } else {
          tryQuality(Math.max(quality - 0.15, 0.1))
        }
      }
      tryQuality(0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function InputBar() {
  const listening = useAppStore((s) => s.listening)
  const chatPending = useAppStore((s) => s.chatPending)
  const [text, setText] = useState('')
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const speech = useSpeechInput((transcript, isFinal) => {
    setText(transcript)
    if (isFinal) handleSubmit(transcript)
  })

  function resize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, window.innerHeight * 0.45)}px`
  }

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return
    const loaded = await Promise.all(Array.from(files).map(compressImage))
    setPendingImages((prev) => [...prev, ...loaded])
  }

  async function handleSubmit(overrideText?: string) {
    if (listening) speech.stop()
    const value = (overrideText ?? text).trim()
    if (!value && !pendingImages.length) return

    const images = pendingImages
    setPendingImages([])
    setText('')
    requestAnimationFrame(resize)

    const chatPanelState = useAppStore.getState().chatPanelState
    if (chatPanelState === 'expanded') {
      await sendChatMessage(value, images)
      return
    }
    if (images.length) {
      await openChat(value, images)
      return
    }
    await openChat(value)
  }

  function handleSendClick() {
    if (isChatLoading()) { abortChat(); return }
    handleSubmit()
  }

  return (
    <>
      <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
      <div className="input-bar">
        <button className={`mic-btn${listening ? ' listening' : ''}`} aria-label="Voice input" onClick={() => (listening ? speech.stop() : speech.start())}>
          <Icon name="mic" size={18} />
        </button>
        <button className={`attach-btn${pendingImages.length ? ' has-images' : ''}`} aria-label="Attach image" onClick={() => fileInputRef.current?.click()}>
          <Icon name="photo_camera" size={18} />
          {pendingImages.length > 0 && <span className="attach-badge">{pendingImages.length}</span>}
        </button>
        <textarea
          ref={textareaRef}
          className="input-field"
          rows={1}
          placeholder={listening ? 'Listening…' : 'Type something…'}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          disabled={chatPending}
          value={text}
          onChange={(e) => { setText(e.target.value); resize() }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
        />
        <button className="send-btn" aria-label="Send" onClick={handleSendClick}>
          <Icon name={chatPending ? 'stop' : 'keyboard_double_arrow_right'} size={18} />
        </button>
      </div>
    </>
  )
}
