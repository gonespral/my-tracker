import { useEffect, useState } from 'react'
import { useAppStore } from '../store'
import { fetchDailyWisdom } from '../lib/ai'
import Icon from './Icon'

export default function WisdomCard() {
  const currentUser = useAppStore((s) => s.currentUser)
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    fetchDailyWisdom().then((t) => {
      setText(t)
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleReload() {
    if (!currentUser) return
    localStorage.removeItem(`tracker-wisdom-${currentUser.id}`)
    load()
  }

  if (!loading && !text) return null

  return (
    <div className="wisdom-card">
      <div className="wisdom-header">
        <div className="wisdom-title">Claude Wisdom</div>
        <button className="wisdom-reload-btn" aria-label="Regenerate" onClick={handleReload}>
          <Icon name="refresh" size={14} />
        </button>
      </div>
      <div className={`wisdom-text${loading ? ' wisdom-loading' : ''}`}>{loading ? 'Loading...' : text}</div>
    </div>
  )
}
