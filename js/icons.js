const _a = (s) =>
  `width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"`

const _defs = {
  lift:   (s) => `<svg ${_a(s)}><path d="M6 4v16M18 4v16M2 9h4M18 9h4M2 15h4M18 15h4M6 9h12M6 15h12"/></svg>`,
  run:    (s) => `<svg ${_a(s)}><circle cx="13" cy="4" r="2"/><path d="M7.5 22L12 14l3 3 3.5-6.5"/><path d="M17 9.5l-3-2.5-4 3 2 2"/></svg>`,
  cycle:  (s) => `<svg ${_a(s)}><circle cx="5.5" cy="17" r="3.5"/><circle cx="18.5" cy="17" r="3.5"/><path d="M5.5 17L9 7h6l3.5 10"/><path d="M9 7l9.5 10"/></svg>`,
  swim:   (s) => `<svg ${_a(s)}><path d="M2 12c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M2 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><circle cx="13" cy="5" r="1.5"/><path d="M13 6.5l-2.5 3-2-1.5"/></svg>`,
  walk:   (s) => `<svg ${_a(s)}><circle cx="12" cy="3" r="2"/><path d="M10 8l-3 8 5-2 3 7"/><path d="M10 8l4 4"/></svg>`,
  yoga:   (s) => `<svg ${_a(s)}><circle cx="12" cy="3" r="2"/><path d="M12 5v4"/><path d="M8 9l4 2 4-2"/><path d="M8 9l-1 5h10l-1-5"/></svg>`,
  hiit:   (s) => `<svg ${_a(s)} stroke-width="2.2"><polyline points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  tennis: (s) => `<svg ${_a(s)}><circle cx="10" cy="10" r="7"/><line x1="15" y1="15" x2="21" y2="21"/><path d="M3.5 10a6.5 6.5 0 0 1 13 0"/><path d="M10 3.5a6.5 6.5 0 0 1 0 13"/></svg>`,
  climb:  (s) => `<svg ${_a(s)}><circle cx="11" cy="5" r="2"/><path d="M11 7l-3 6 4-2 3 7"/><path d="M8 13l-3 5"/><path d="M14 11l3-4"/></svg>`,
  row:    (s) => `<svg ${_a(s)}><path d="M2 17c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 3 2 4.5 0"/><path d="M5 9l7-5 7 5"/><path d="M12 4v5"/></svg>`,
  ball:   (s) => `<svg ${_a(s)}><circle cx="12" cy="12" r="10"/><path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10 15 15 0 0 1-4-10A15 15 0 0 1 12 2z"/><path d="M2 12h20"/></svg>`,
  box:    (s) => `<svg ${_a(s)}><path d="M4 8l8-6 8 6v14H4z"/><path d="M9 3l3 9"/><path d="M15 3l-3 9"/><line x1="4" y1="16" x2="20" y2="16"/></svg>`,
}

export function typeIcon(type, size = 15) {
  return (_defs[type] || _defs.lift)(size)
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
