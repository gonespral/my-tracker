import { useAppStore } from '../store'
import { closeSheet } from '../lib/sheets'

export default function Backdrop() {
  const hasOpenSheet = useAppStore((s) => s.openSheetId !== null)
  const chatExpanded = useAppStore((s) => s.chatPanelState === 'expanded')

  function handleClick() {
    if (hasOpenSheet) closeSheet()
    else if (chatExpanded) useAppStore.setState({ chatPanelState: 'peek' })
  }

  return <div className={`backdrop${hasOpenSheet || chatExpanded ? ' visible' : ''}${chatExpanded ? ' chat-active' : ''}`} onClick={handleClick} />
}
