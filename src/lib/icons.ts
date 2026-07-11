export const TYPE_ICON_NAME: Record<string, string> = {
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

export function typeIconName(type?: string): string {
  return (type && TYPE_ICON_NAME[type]) || TYPE_ICON_NAME.lift
}

// Strava/Google sport_type string → internal type key
export const SPORT_TYPE_MAP: Record<string, string> = {
  Swim: 'swim',
  Ride: 'cycle', VirtualRide: 'cycle', EBikeRide: 'cycle',
  GravelRide: 'cycle', MountainBikeRide: 'cycle', EMountainBikeRide: 'cycle',
  Run: 'run', VirtualRun: 'run', TrailRun: 'run',
  Walk: 'walk', Hike: 'walk',
  Rowing: 'row',
  WeightTraining: 'lift', Crossfit: 'hiit',
  Yoga: 'yoga', Pilates: 'yoga',
}
