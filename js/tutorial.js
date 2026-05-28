import { state } from './state.js'
import { isDemo } from './db.js'

const SLIDES = [
  {
    logoSlide: true,
    title: 'MyTracker',
    body: 'Your personal health dashboard. Track food, workouts, and weight — all synced to your account across devices.',
  },
  {
    icon: 'bolt',
    title: 'Log food & workouts',
    body: 'Type a meal or activity in the chat bar at the bottom. Claude estimates calories and macros from a description or photo. You can also speak or attach a photo. <a href="/help/logging.html" target="_blank" style="color:inherit;text-decoration:underline">Learn more →</a>',
  },
  {
    icon: 'schedule',
    title: 'The calorie clock',
    body: 'The triangle on your calorie ring shows where you should be in your eating day. It learns your typical meal split over 30 days and advances as you log each meal. <a href="/help/calorie-clock.html" target="_blank" style="color:inherit;text-decoration:underline">Learn more →</a>',
  },
  {
    icon: 'local_fire_department',
    title: 'Calorie targets',
    body: 'Your target is calculated from your BMR and activity level. On training days it automatically increases by your net calories burned. <a href="/help/calorie-targets.html" target="_blank" style="color:inherit;text-decoration:underline">Learn more →</a>',
  },
  {
    icon: 'key',
    title: 'Set up Claude API',
    body: 'Claude needs an Anthropic API key. Get one at console.anthropic.com. Paste it in Settings &rarr; Claude. It stays on this device only.',
  },
  {
    icon: 'directions_bike',
    title: 'Connect Strava',
    body: 'Open Settings &rarr; Strava and tap Connect. Activities import on every load and can be pushed back to Strava with calorie data. <a href="/help/strava.html" target="_blank" style="color:inherit;text-decoration:underline">Learn more →</a>',
  },
  {
    icon: 'monitor_heart',
    title: 'Connect Google Health',
    body: 'Pull activities from Google Fit and other Google Health sources. Open Settings &rarr; Google Health and tap Connect with Google. <a href="/help/strava.html" target="_blank" style="color:inherit;text-decoration:underline">Learn more →</a>',
  },
  {
    icon: 'favorite',
    title: 'Made by Gonçalo Nespral',
    body: 'Open source on GitHub at gonespral/health-tracker. You can revisit this tutorial anytime from Settings → Account.',
  },
]

function getSeenKey() {
  return state.currentUser ? `tracker-tutorial-seen-${state.currentUser.id}` : 'tracker-tutorial-seen'
}

let overlayEl = null
let currentSlide = 0

function render() {
  const slide = SLIDES[currentSlide]
  const isLast = currentSlide === SLIDES.length - 1

  overlayEl.innerHTML = `
    <div class="tutorial-card">
      <button class="tutorial-arrow tutorial-arrow-left${currentSlide === 0 ? ' hidden' : ''}" id="tutorial-prev">
        <span class="material-symbols-outlined">arrow_back</span>
      </button>
      <button class="tutorial-arrow tutorial-arrow-right" id="tutorial-next">
        <span class="material-symbols-outlined">${isLast ? 'check' : 'arrow_forward'}</span>
      </button>
      <div class="tutorial-icon">
        ${slide.logoSlide
      ? `<img src="brand/svg/logo-mono-dark.svg" class="tutorial-logo tutorial-logo-dark" alt="MyTracker">
             <img src="brand/svg/logo-mono-light.svg" class="tutorial-logo tutorial-logo-light" alt="MyTracker">`
      : `<span class="material-symbols-outlined" style="font-size:48px;font-variation-settings:'FILL' 1,'wght' 300,'GRAD' 0,'opsz' 48">${slide.icon}</span>`
    }
      </div>
      <div class="tutorial-title${slide.logoSlide ? ' tutorial-title-logo' : ''}">${slide.title}</div>
      <div class="tutorial-body">${slide.body}</div>
      <div class="tutorial-dots">
        ${SLIDES.map((_, i) => `<div class="tutorial-dot${i === currentSlide ? ' active' : ''}"></div>`).join('')}
      </div>
    </div>
  `

  overlayEl.querySelector('#tutorial-next').addEventListener('click', () => {
    if (isLast) { dismiss(); return }
    currentSlide++
    render()
  })
  overlayEl.querySelector('#tutorial-prev')?.addEventListener('click', () => {
    if (currentSlide > 0) { currentSlide--; render() }
  })
}

function dismiss() {
  localStorage.setItem(getSeenKey(), '1')
  overlayEl.classList.remove('visible')
  setTimeout(() => {
    overlayEl.remove()
    overlayEl = null
  }, 300)
}

export function showTutorial() {
  if (overlayEl) return
  currentSlide = 0

  overlayEl = document.createElement('div')
  overlayEl.className = 'tutorial-overlay'
  document.body.appendChild(overlayEl)

  render()

  // Trigger transition
  requestAnimationFrame(() => requestAnimationFrame(() => overlayEl.classList.add('visible')))
}

export function showTutorialIfNew() {
  if (!state.currentUser) return
  if (isDemo) {
    if (sessionStorage.getItem('tutorial-seen-demo')) return
    sessionStorage.setItem('tutorial-seen-demo', '1')
  } else {
    if (localStorage.getItem(getSeenKey())) return
  }
  showTutorial()
}
