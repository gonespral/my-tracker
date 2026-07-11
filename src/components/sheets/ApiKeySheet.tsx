import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { closeSheet } from '../../lib/sheets'
import { showToast } from '../../lib/toast'
import Sheet from '../Sheet'

export default function ApiKeySheet() {
  const open = useAppStore((s) => s.openSheetId === 'apikey')
  const [key, setKey] = useState('')

  useEffect(() => {
    if (open) setKey('')
  }, [open])

  function handleSave() {
    const trimmed = key.trim()
    if (!trimmed) return
    localStorage.setItem('tracker-anthropic-key', trimmed)
    showToast('API key saved')
    closeSheet()
  }

  return (
    <Sheet open={open} title="Set up Sonnet 4.6">
      <p className="setup-note">
        Paste your <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">Anthropic API key</a>.
        Stored locally — never sent anywhere except Anthropic's API.
      </p>
      <div className="form-field">
        <label className="form-label" htmlFor="apikey-input">API key</label>
        <input className="form-input" id="apikey-input" type="password" placeholder="sk-ant-..." autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} />
      </div>
      <button className="btn-primary" onClick={handleSave}>Save</button>
    </Sheet>
  )
}
