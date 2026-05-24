import { state } from './state.js'

export function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('show')
  clearTimeout(state.toastTmr)
  state.toastTmr = setTimeout(() => t.classList.remove('show'), 4500)
}

export function openSheet(id) {
  document.getElementById('backdrop').classList.add('visible')
  document.getElementById(id).classList.add('open')
}

export function closeSheets() {
  document.getElementById('backdrop').classList.remove('visible')
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('open'))
  state.pendingEditFoodId    = null
  state.pendingEditWorkoutId = null
  state.pendingEditWeightDate = null
  const logBtn = document.getElementById('log-food-btn')
  if (logBtn) logBtn.textContent = 'Log Food'
  const wkBtn = document.getElementById('save-workout-btn')
  if (wkBtn) wkBtn.textContent = 'Log Workout'
  // Re-enable date inputs in case they were disabled for edit mode
  const fDate = document.getElementById('f-date')
  if (fDate) fDate.disabled = false
  const wDate = document.getElementById('w-date')
  if (wDate) wDate.disabled = false
}

export function toggleEntryMenu(btn) {
  const menu = btn.nextElementSibling
  const isOpen = menu.classList.contains('open')
  closeMenus()
  if (!isOpen) menu.classList.add('open')
}

export const closeMenus = () =>
  document.querySelectorAll('.entry-menu.open').forEach(m => m.classList.remove('open'))
