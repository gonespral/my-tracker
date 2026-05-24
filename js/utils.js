export const dateStr = (d) => {
  d = d || new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export const yesterdayStr = () => {
  const d = new Date(); d.setDate(d.getDate() - 1); return dateStr(d)
}

export const nowTime = () => {
  const d = new Date(), h = d.getHours(), m = d.getMinutes()
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'pm':'am'}`
}

export const sumFood = (entries) => entries.reduce(
  (a, e) => ({ calories: a.calories+(e.calories||0), protein: a.protein+(e.protein||0),
               carbs: a.carbs+(e.carbs||0), fat: a.fat+(e.fat||0) }),
  { calories: 0, protein: 0, carbs: 0, fat: 0 }
)

export const fmt   = (n) => parseFloat((+n || 0).toFixed(1))
export const round = (n) => Math.round(+n || 0)
export const cap   = (s) => s ? s.charAt(0).toUpperCase()+s.slice(1) : s

export const fmtDate = (str) => {
  const [y,m,d] = str.split('-').map(Number)
  return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})
}

export const fmtDateShort = (str) => {
  const [y,m,d] = str.split('-').map(Number)
  return new Date(y,m-1,d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})
}
