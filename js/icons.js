const TYPE_ICON_NAME = {
  lift: 'fitness_center',
  run: 'directions_run',
  cycle: 'directions_bike',
  swim: 'pool',
  walk: 'directions_walk',
  yoga: 'self_improvement',
  hiit: 'bolt',
  tennis: 'sports_tennis',
  climb: 'hiking',
  row: 'rowing',
  ball: 'sports_soccer',
  box: 'sports_martial_arts',
}

export function materialIcon(name, size = 15, options = {}) {
  const fill = options.fill ?? 0
  const weight = options.weight ?? 400
  const grade = options.grade ?? 0
  const opsz = options.opsz ?? 24
  const className = options.className ? ` ${options.className}` : ''
  const style = options.style ? `${options.style};` : ''
  return `<span class="material-symbols-outlined${className}" aria-hidden="true" style="font-size:${size}px;${style}font-variation-settings:'FILL' ${fill},'wght' ${weight},'GRAD' ${grade},'opsz' ${opsz}">${name}</span>`
}

export function typeIcon(type, size = 15) {
  return materialIcon(TYPE_ICON_NAME[type] || TYPE_ICON_NAME.lift, size)
}

// Strava/Google sport_type string → internal type key
export const SPORT_TYPE_MAP = {
  Swim: 'swim',
  Ride: 'cycle', VirtualRide: 'cycle', EBikeRide: 'cycle',
  GravelRide: 'cycle', MountainBikeRide: 'cycle', EMountainBikeRide: 'cycle',
  Run: 'run', VirtualRun: 'run', TrailRun: 'run',
  Walk: 'walk', Hike: 'walk',
  Rowing: 'row',
  WeightTraining: 'lift', Crossfit: 'hiit',
  Yoga: 'yoga', Pilates: 'yoga',
}
