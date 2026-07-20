import { useEffect } from 'react'

// iOS Safari (and some Android browsers) don't shrink the layout viewport
// when the on-screen keyboard opens — only window.visualViewport shrinks.
// Left alone, the browser's own "scroll the focused input into view"
// behavior takes over and scrolls the whole page up, hiding the top bar
// behind the keyboard. Tracking the visual viewport directly and driving
// #app's height (and #chat-panel's fixed offset) from it means the app
// shell itself shrinks to fit above the keyboard, so there's nothing left
// for the browser to auto-scroll — the input bar and chat panel end up
// sitting right above the keyboard with the top bar still visible.
export function useViewportKeyboard() {
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return

    function update() {
      const root = document.documentElement
      root.style.setProperty('--app-height', `${vv!.height}px`)
      const inset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop)
      root.style.setProperty('--keyboard-inset', `${inset}px`)
    }

    update()
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
}
