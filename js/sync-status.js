const counts = new Map()
const failed = new Set()

function render() {
  const el = document.getElementById('sync-status')
  const btn = document.getElementById('refresh-btn')
  const dot = el?.querySelector('.sync-dot')

  const hasFailed = failed.size > 0
  const isSyncing = counts.size > 0

  if (!hasFailed && !isSyncing) {
    if (el) el.hidden = true
    btn?.classList.remove('spinning')
    return
  }

  if (el) {
    el.hidden = false
    const labels = [...new Set([...failed, ...counts.keys()])]
    el.querySelector('.sync-label').textContent = labels.join(' · ')
    if (dot) dot.classList.toggle('sync-dot--failed', hasFailed && !isSyncing)
  }
  if (isSyncing) btn?.classList.add('spinning')
  else btn?.classList.remove('spinning')
}

export function clearFailed() {
  failed.clear()
  render()
}

export function startSync(name) {
  failed.delete(name)
  counts.set(name, (counts.get(name) || 0) + 1)
  render()
}

export function endSync(name) {
  const n = (counts.get(name) || 0) - 1
  if (n <= 0) counts.delete(name)
  else counts.set(name, n)
  render()
}

export function failSync(name) {
  const n = (counts.get(name) || 0) - 1
  if (n <= 0) counts.delete(name)
  else counts.set(name, n)
  failed.add(name)
  render()
}
