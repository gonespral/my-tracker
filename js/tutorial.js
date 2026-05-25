import { state } from './state.js'
import { isDemo } from './db.js'

const SLIDES = [
  {
    logoSlide: true,
    title: 'MyTracker',
    body: 'Your personal health dashboard. Track food, workouts, and weight — all synced to your account across devices.',
  },
  {
    icon: 'restaurant',
    title: 'Log food & macros',
    body: 'Type a meal in the chat bar at the bottom — Claude will estimate calories and macros from a description or photo. Or tap any meal section on Today to log manually.',
  },
  {
    icon: 'directions_run',
    title: 'Log workouts',
    body: 'Log activities with intensity, duration, distance, and calories burned. Your daily calorie target automatically increases on training days.',
  },
  {
    icon: 'smart_toy',
    title: 'Chat with Claude AI',
    body: 'The input bar connects you to Claude. Log meals, describe workouts, ask nutrition questions, or snap a photo of your food — Claude understands natural language.',
  },
  {
    icon: 'key',
    title: 'Set up AI features',
    body: 'AI features need an Anthropic API key. Get one at console.anthropic.com — there\'s a free tier. Paste it in Settings → Claude AI. It stays on this device only.',
  },
  {
    icon: 'directions_bike',
    title: 'Connect Strava',
    body: 'Sync your Strava activities automatically. Open Settings → Strava and tap Connect. Activities import on every load and can be pushed to Strava when you log them here.',
  },
  {
    icon: 'local_fire_department',
    title: 'Calorie spoofing',
    body: 'Strava does not let you set calories on manually logged activities. Enable "Calorie spoofing" in Settings → Strava to work around this: the app estimates a synthetic heart rate from your calories, age, weight, and sex, then uploads the activity as a TCX file so Strava computes the correct calorie count from the heart rate data.',
  },
  {
    icon: 'monitor_heart',
    title: 'Connect Google Health',
    body: 'Pull activities from Google Fit and other Google Health sources. Open Settings → Google Health and tap Connect with Google.',
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
  if (!isDemo && localStorage.getItem(getSeenKey())) return
  showTutorial()
}
