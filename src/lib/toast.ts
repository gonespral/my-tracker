let toastTimer: ReturnType<typeof setTimeout> | undefined

export function showToast(msg: string) {
  const t = document.getElementById('toast')
  if (!t) return
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('show'), 4500)
}
