import { useEffect, useId, useRef, type ReactNode } from 'react'
import { useAppStore } from '../store'
import Icon from './Icon'

// Shared three-dot dropdown used by every list item (food/activity/preset).
// Only one menu is ever open at a time (matches the old app's closeMenus()
// behavior), and clicking anywhere outside the open menu closes it.
export default function EntryMenu({ children }: { children: ReactNode }) {
  const id = useId()
  const open = useAppStore((s) => s.openEntryMenuId === id)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(e: PointerEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        useAppStore.setState((s) => (s.openEntryMenuId === id ? { openEntryMenuId: null } : s))
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)

    // Ancestor cards (.anim-item stagger animation, stacked conflict rows)
    // form stacking contexts that would trap the menu underneath the next
    // card, so raise every host card while the menu is open (same hosts the
    // old toggleEntryMenu() raised).
    const hosts = ['.anim-item', '.log-item', '.conflict-stack', '.meal-preset-item']
      .map((sel) => wrapRef.current?.closest<HTMLElement>(sel))
      .filter((el): el is HTMLElement => !!el)
    for (const host of hosts) {
      host.style.position = 'relative'
      host.style.zIndex = '10000'
    }

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      for (const host of hosts) {
        host.style.position = ''
        host.style.zIndex = ''
      }
    }
  }, [open, id])

  function toggle() {
    useAppStore.setState((s) => ({ openEntryMenuId: s.openEntryMenuId === id ? null : id }))
  }

  function close() {
    useAppStore.setState({ openEntryMenuId: null })
  }

  return (
    <div className="entry-menu-wrap" ref={wrapRef} onClick={(e) => e.stopPropagation()}>
      <button className="icon-btn entry-menu-btn" onClick={toggle}>
        <Icon name="more_vert" size={16} />
      </button>
      {open && (
        <div className="entry-menu" style={{ display: 'block' }} onClick={close}>
          {children}
        </div>
      )}
    </div>
  )
}
