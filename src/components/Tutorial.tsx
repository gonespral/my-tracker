import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '../store'
import { isDemo } from '../lib/db'
import Icon from './Icon'

interface Slide {
  logoSlide?: boolean
  icon?: string
  title: string
  body: ReactNode
}

const learnMoreStyle = { color: 'inherit', textDecoration: 'underline' } as const

const SLIDES: Slide[] = [
  {
    logoSlide: true,
    title: 'MyTracker',
    body: 'Your personal health dashboard. Track food, workouts, and weight — all synced to your account across devices.',
  },
  {
    icon: 'bolt',
    title: 'Log food & workouts',
    body: <>Type a meal or activity in the chat bar at the bottom. Claude looks up real nutrition data (USDA, Open Food Facts) before estimating calories and macros, showing what it checked right in the chat. You can also speak or attach a photo. <a href="help/logging.html" target="_blank" rel="noopener" style={learnMoreStyle}>Learn more →</a></>,
  },
  {
    icon: 'schedule',
    title: 'The calorie clock',
    body: <>The triangle on your calorie ring shows where you should be in your eating day. It learns your typical meal split over 30 days and advances as you log each meal. <a href="help/calorie-clock.html" target="_blank" rel="noopener" style={learnMoreStyle}>Learn more →</a></>,
  },
  {
    icon: 'local_fire_department',
    title: 'Calorie targets',
    body: <>Your target starts with a maintenance TDEE baseline, then you subtract your chosen deficit. Activity calories stay visible for context, but they do not change the goal. <a href="help/calorie-targets.html" target="_blank" rel="noopener" style={learnMoreStyle}>Learn more →</a></>,
  },
  {
    icon: 'key',
    title: 'Set up Sonnet 4.6 API',
    body: 'Claude needs an Anthropic API key. Get one at console.anthropic.com. Paste it in Settings → Integrations & API Keys. It stays on this device only. The food database lookup works out of the box too — add your own free USDA key there if you ever hit a rate limit.',
  },
  {
    icon: 'directions_bike',
    title: 'Connect Strava',
    body: <>Open Settings → Integrations & API Keys → Manage Integrations and tap Connect. Activities import on every load and can be pushed back to Strava with calorie data. <a href="help/strava.html" target="_blank" rel="noopener" style={learnMoreStyle}>Learn more →</a></>,
  },
  {
    icon: 'monitor_heart',
    title: 'Connect Google Health',
    body: <>Pull activities from Google Fit and other Google Health sources. Open Settings → Integrations & API Keys → Manage Integrations and tap Connect with Google. <a href="help/strava.html" target="_blank" rel="noopener" style={learnMoreStyle}>Learn more →</a></>,
  },
  {
    icon: 'favorite',
    title: 'Made by Gonçalo Nespral',
    body: 'Open source on GitHub at gonespral/health-tracker. You can revisit this tutorial anytime from Settings → Account.',
  },
]

function getSeenKey() {
  const user = useAppStore.getState().currentUser
  return user ? `tracker-tutorial-seen-${user.id}` : 'tracker-tutorial-seen'
}

export function openTutorial() {
  useAppStore.setState({ tutorialOpen: true })
}

// First-run slideshow overlay (port of js/tutorial.js). Auto-shows once per
// user (per session in demo mode); reopenable from Settings → Account.
export default function Tutorial() {
  const open = useAppStore((s) => s.tutorialOpen)
  const currentUser = useAppStore((s) => s.currentUser)
  const [slide, setSlide] = useState(0)
  const [visible, setVisible] = useState(false)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (!currentUser || checkedRef.current) return
    checkedRef.current = true
    if (isDemo) {
      if (sessionStorage.getItem('tutorial-seen-demo')) return
      sessionStorage.setItem('tutorial-seen-demo', '1')
    } else if (localStorage.getItem(getSeenKey())) {
      return
    }
    useAppStore.setState({ tutorialOpen: true })
  }, [currentUser])

  useEffect(() => {
    if (!open) return
    setSlide(0)
    // Double rAF so the overlay mounts hidden first and the fade-in transition plays
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
    return () => cancelAnimationFrame(raf)
  }, [open])

  if (!open) return null

  const s = SLIDES[slide]
  const isLast = slide === SLIDES.length - 1

  function dismiss() {
    localStorage.setItem(getSeenKey(), '1')
    setVisible(false)
    setTimeout(() => useAppStore.setState({ tutorialOpen: false }), 300)
  }

  return (
    <div className={`tutorial-overlay${visible ? ' visible' : ''}`}>
      <div className="tutorial-card">
        <button className={`tutorial-arrow tutorial-arrow-left${slide === 0 ? ' hidden' : ''}`} onClick={() => slide > 0 && setSlide(slide - 1)}>
          <Icon name="arrow_back" size={24} />
        </button>
        <button className="tutorial-arrow tutorial-arrow-right" onClick={() => (isLast ? dismiss() : setSlide(slide + 1))}>
          <Icon name={isLast ? 'check' : 'arrow_forward'} size={24} />
        </button>
        <div className="tutorial-icon">
          {s.logoSlide ? (
            <>
              <img src="brand/svg/logo-mono-dark.svg" className="tutorial-logo tutorial-logo-dark" alt="MyTracker" />
              <img src="brand/svg/logo-mono-light.svg" className="tutorial-logo tutorial-logo-light" alt="MyTracker" />
            </>
          ) : (
            <Icon name={s.icon!} size={48} fill={1} weight={300} opsz={48} />
          )}
        </div>
        <div className={`tutorial-title${s.logoSlide ? ' tutorial-title-logo' : ''}`}>{s.title}</div>
        <div className="tutorial-body">{s.body}</div>
        <div className="tutorial-dots">
          {SLIDES.map((_, i) => <div key={i} className={`tutorial-dot${i === slide ? ' active' : ''}`} />)}
        </div>
      </div>
    </div>
  )
}
