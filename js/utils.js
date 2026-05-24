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

export const formatTimeToAMPM = (val) => {
  if (!val) return nowTime()
  let d
  if (val instanceof Date) {
    d = val
  } else if (typeof val === 'string') {
    if (/^\d{1,2}:\d{2}\s*[ap]m$/i.test(val.trim())) return val.trim().toLowerCase()
    
    d = new Date(val)
    if (isNaN(d.getTime())) {
      const tMatch = val.match(/[T\s]?(\d{1,2}):(\d{2})/)
      if (tMatch) {
        const h = Number(tMatch[1]), m = Number(tMatch[2])
        return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'pm':'am'}`
      }
      return nowTime()
    }
  } else {
    d = new Date(val)
  }
  if (isNaN(d.getTime())) return nowTime()
  const h = d.getHours(), m = d.getMinutes()
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'pm':'am'}`
}

export const toUTCISO = (dateStr, timeStr) => {
  if (timeStr && typeof timeStr === 'string' && timeStr.includes('T')) {
    const d = new Date(timeStr)
    if (!isNaN(d.getTime())) return d.toISOString()
  }
  
  const d = new Date()
  if (dateStr && timeStr) {
    let hours, minutes;
    const matchAMPM = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})\s*([ap]m)$/i)
    if (matchAMPM) {
      hours = Number(matchAMPM[1]) % 12
      if (matchAMPM[3].toLowerCase() === 'pm') hours += 12
      minutes = Number(matchAMPM[2])
    } else {
      const match24 = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})$/)
      if (match24) {
        hours = Number(match24[1])
        minutes = Number(match24[2])
      }
    }
    if (hours !== undefined) {
      const [year, month, day] = dateStr.split('-').map(Number)
      d.setFullYear(year, month - 1, day)
      d.setHours(hours, minutes, 0, 0)
    }
  }
  return d.toISOString()
}

export const formatTimeTo24H = (val) => {
  if (!val) return ''
  const d = new Date(val)
  if (isNaN(d.getTime())) return ''
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

export const calculateNetActiveCalories = (workouts, bmr) => {
  if (!workouts || !workouts.length) return 0
  const bmrPerMin = (bmr || 1800) / 1440
  return workouts.reduce((sum, w) => {
    if (w.isDuplicate) return sum
    const gross = w.calories_burned || 0
    const duration = w.duration_min || 0
    const net = duration > 0 ? Math.max(0, gross - (bmrPerMin * duration)) : gross
    return sum + net
  }, 0)
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
