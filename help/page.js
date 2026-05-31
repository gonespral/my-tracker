// Apply saved theme before first paint
;(function () {
  const t = localStorage.getItem('tracker-theme') ||
    (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light')
  document.documentElement.setAttribute('data-theme', t)
})()

// Load Material Symbols (same source as the main app)
;(function () {
  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200'
  document.head.appendChild(link)
})()

document.addEventListener('DOMContentLoaded', () => {
  const page = document.querySelector('.help-page')
  if (!page) return

  const isIndex = /\/help\/?$|\/help\/index\.html$/.test(window.location.pathname)
  const helpDir   = window.location.pathname.replace(/\/[^/]*$/, '/')
  const backHref  = isIndex ? '/' : helpDir + 'index.html'
  const backLabel = isIndex ? 'Back to MyTracker' : 'Documentation'

  const backEl = document.createElement('div')
  backEl.className = 'help-back'
  backEl.innerHTML = `<a href="${backHref}">
    <svg viewBox="0 0 16 16" fill="currentColor">
      <path d="M7.78 12.53a.75.75 0 0 1-1.06 0L2.47 8.28a.75.75 0 0 1 0-1.06l4.25-4.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L4.81 7h7.44a.75.75 0 0 1 0 1.5H4.81l2.97 2.97a.75.75 0 0 1 0 1.06z"/>
    </svg>
    ${backLabel}
  </a>`
  page.insertAdjacentElement('beforebegin', backEl)

  const footerEl = document.createElement('footer')
  footerEl.className = 'help-footer'
  footerEl.innerHTML = `<p>MyTracker &middot; <a href="/">Back to app</a> &middot; <a href="/privacy.html">Privacy</a> &middot; <a href="/terms.html">Terms</a></p>`
  page.insertAdjacentElement('afterend', footerEl)
})
