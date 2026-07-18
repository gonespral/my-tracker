import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface AutocompleteSuggestion {
  id: string
  name: string
  calories?: number | null
}

// Text input with a preset-suggestion dropdown (port of the old
// `f-desc-ac`/`w-desc-ac` autocomplete in app.js). The parent supplies the
// already-filtered suggestion list; the dropdown shows while the user is
// typing and closes on selection or on any click outside the wrap.
export default function AutocompleteInput({ id, value, placeholder, suggestions, onChange, onSelect, endButton }: {
  id: string
  value: string
  placeholder?: string
  suggestions: AutocompleteSuggestion[]
  onChange: (text: string) => void
  onSelect: (id: string) => void
  endButton?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [open])

  const show = open && value.trim().length > 0 && suggestions.length > 0

  return (
    <div className="autocomplete-wrap" ref={wrapRef}>
      <input
        className={`form-input${endButton ? ' has-end-btn' : ''}`}
        id={id}
        type="text"
        placeholder={placeholder}
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true) }}
      />
      {endButton && <div className="autocomplete-end-btn">{endButton}</div>}
      <div className={`autocomplete-list${show ? ' open' : ''}`}>
        {show && suggestions.map((s) => (
          <div key={s.id} className="autocomplete-item" onClick={() => { onSelect(s.id); setOpen(false) }}>
            <span className="autocomplete-item-name">{s.name}</span>
            {s.calories != null && <span className="autocomplete-item-cal">{Math.round(s.calories)} kcal</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
