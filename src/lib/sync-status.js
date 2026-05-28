import { writable } from 'svelte/store'

const counts = new Map()
const failed = new Set()

// Store exported so TopBar can subscribe and render sync state reactively
export const syncStatus = writable({ isSyncing: false, hasFailed: false, labels: [] })

function update() {
  const hasFailed = failed.size > 0
  const isSyncing = counts.size > 0
  const labels = [...new Set([...failed, ...counts.keys()])]
  syncStatus.set({ isSyncing, hasFailed, labels })
}

export function clearFailed() {
  failed.clear()
  update()
}

export function startSync(name) {
  failed.delete(name)
  counts.set(name, (counts.get(name) || 0) + 1)
  update()
}

export function endSync(name) {
  const n = (counts.get(name) || 0) - 1
  if (n <= 0) counts.delete(name)
  else counts.set(name, n)
  update()
}

export function failSync(name) {
  const n = (counts.get(name) || 0) - 1
  if (n <= 0) counts.delete(name)
  else counts.set(name, n)
  failed.add(name)
  update()
}
