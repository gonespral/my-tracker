import { useAppStore } from '../store'

export function clearFailed() {
  useAppStore.setState({ syncFailed: new Set() })
}

export function startSync(name: string) {
  const { syncCounts, syncFailed } = useAppStore.getState()
  const nextFailed = new Set(syncFailed)
  nextFailed.delete(name)
  useAppStore.setState({
    syncFailed: nextFailed,
    syncCounts: { ...syncCounts, [name]: (syncCounts[name] || 0) + 1 },
  })
}

export function endSync(name: string) {
  const { syncCounts } = useAppStore.getState()
  const n = (syncCounts[name] || 0) - 1
  const next = { ...syncCounts }
  if (n <= 0) delete next[name]
  else next[name] = n
  useAppStore.setState({ syncCounts: next })
}

export function failSync(name: string) {
  const { syncCounts, syncFailed } = useAppStore.getState()
  const n = (syncCounts[name] || 0) - 1
  const next = { ...syncCounts }
  if (n <= 0) delete next[name]
  else next[name] = n
  useAppStore.setState({ syncCounts: next, syncFailed: new Set(syncFailed).add(name) })
}
