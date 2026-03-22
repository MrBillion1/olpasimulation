// ============= Match Engine Types & Logic =============

export type ZoneId = 
  | 'def-left' | 'def-center' | 'def-right'
  | 'mid-left' | 'mid-center' | 'mid-right'
  | 'att-left' | 'att-center' | 'att-right';

export type EventType = 
  | 'Pass' | 'Tackle' | 'Shot' | 'Dribble' | 'Cross' 
  | 'Long Ball' | 'Clearance' | 'Foul' | 'Save' | 'Header';

export type SignificanceType = 
  | 'No shift' | 'Build-up play' | 'Creates counter-attack' 
  | 'Momentum swing to home' | 'Momentum swing to away'
  | 'High goal-scoring chance' | 'Breaks defensive line' | 'Kills attack';

export interface WeightBreakdown {
  base: number;
  zone: number;
  significance: number;
  time: number;
  final: number;
}

export interface MatchEvent {
  id: string;
  type: EventType;
  zone: ZoneId;
  significance: SignificanceType;
  minute: number;
  weight: WeightBreakdown;
  team: 'home' | 'away';
  description: string;
}

export interface MatchState {
  minute: number;
  homeScore: number;
  awayScore: number;
  half: 1 | 2;
  events: MatchEvent[];
  momentum: number; // -1 (away) to 1 (home)
  isRunning: boolean;
  selectedZone: ZoneId;
}

// Base weights per event type (success probability)
export const BASE_WEIGHTS: Record<EventType, number> = {
  'Pass': 0.82,
  'Tackle': 0.65,
  'Shot': 0.32,
  'Dribble': 0.58,
  'Cross': 0.45,
  'Long Ball': 0.40,
  'Clearance': 0.78,
  'Foul': 0.55,
  'Save': 0.60,
  'Header': 0.38,
};

export const EVENT_TYPES: EventType[] = Object.keys(BASE_WEIGHTS) as EventType[];

export const SIGNIFICANCE_TYPES: SignificanceType[] = [
  'No shift', 'Build-up play', 'Creates counter-attack',
  'Momentum swing to home', 'Momentum swing to away',
  'High goal-scoring chance', 'Breaks defensive line', 'Kills attack',
];

export const ZONES: { id: ZoneId; label: string; row: number; col: number }[] = [
  { id: 'def-left', label: 'Def L', row: 0, col: 0 },
  { id: 'def-center', label: 'Def C', row: 0, col: 1 },
  { id: 'def-right', label: 'Def R', row: 0, col: 2 },
  { id: 'mid-left', label: 'Mid L', row: 1, col: 0 },
  { id: 'mid-center', label: 'Mid C', row: 1, col: 1 },
  { id: 'mid-right', label: 'Mid R', row: 1, col: 2 },
  { id: 'att-left', label: 'Att L', row: 2, col: 0 },
  { id: 'att-center', label: 'Att C', row: 2, col: 1 },
  { id: 'att-right', label: 'Att R', row: 2, col: 2 },
];

const ZONE_MODIFIERS: Record<string, Partial<Record<EventType, number>>> = {
  'def': {
    'Pass': 0.10, 'Tackle': 0.15, 'Shot': -0.25, 'Dribble': -0.10,
    'Cross': -0.15, 'Long Ball': 0.05, 'Clearance': 0.20, 'Foul': 0.10,
    'Save': 0.15, 'Header': -0.10,
  },
  'mid': {
    'Pass': 0.05, 'Tackle': 0.05, 'Shot': -0.10, 'Dribble': 0.10,
    'Cross': 0.05, 'Long Ball': 0.10, 'Clearance': 0.00, 'Foul': 0.00,
    'Save': -0.05, 'Header': 0.05,
  },
  'att': {
    'Pass': -0.05, 'Tackle': -0.10, 'Shot': 0.25, 'Dribble': 0.15,
    'Cross': 0.20, 'Long Ball': -0.10, 'Clearance': -0.20, 'Foul': -0.05,
    'Save': -0.15, 'Header': 0.20,
  },
};

const SIGNIFICANCE_MODIFIERS: Record<SignificanceType, number> = {
  'No shift': 0.00,
  'Build-up play': 0.08,
  'Creates counter-attack': 0.25,
  'Momentum swing to home': 0.15,
  'Momentum swing to away': 0.15,
  'High goal-scoring chance': 0.40,
  'Breaks defensive line': 0.22,
  'Kills attack': -0.12,
};

export function getZoneModifier(zone: ZoneId, eventType: EventType): number {
  const zoneGroup = zone.startsWith('def') ? 'def' : zone.startsWith('mid') ? 'mid' : 'att';
  return ZONE_MODIFIERS[zoneGroup]?.[eventType] ?? 0;
}

export function getTimeModifier(minute: number, eventType: EventType): number {
  const defensive = ['Tackle', 'Clearance', 'Save', 'Foul'];
  const offensive = ['Shot', 'Cross', 'Dribble', 'Header'];
  
  if (minute <= 15) {
    // Early game: slight penalty across the board
    return defensive.includes(eventType) ? -0.05 : -0.08;
  } else if (minute >= 75) {
    // Late game: fatigue effects
    return defensive.includes(eventType) ? 0.18 : (offensive.includes(eventType) ? -0.10 : 0.05);
  } else if (minute >= 40 && minute <= 48) {
    // End of half tension
    return 0.08;
  }
  return 0;
}

export function calculateWeight(
  eventType: EventType,
  zone: ZoneId,
  significance: SignificanceType,
  minute: number
): WeightBreakdown {
  const base = BASE_WEIGHTS[eventType];
  const zoneMod = getZoneModifier(zone, eventType);
  const sigMod = SIGNIFICANCE_MODIFIERS[significance];
  const timeMod = getTimeModifier(minute, eventType);
  const final = Math.max(0.01, Math.min(0.99, base + zoneMod + sigMod + timeMod));
  
  return { base, zone: zoneMod, significance: sigMod, time: timeMod, final: Math.round(final * 100) / 100 };
}

export function getSignificanceDescription(sig: SignificanceType, weight: number): string {
  const pct = Math.round(weight * 100);
  switch (sig) {
    case 'High goal-scoring chance': return `Leads to ${Math.min(pct + 12, 95)}% goal chance increase`;
    case 'Creates counter-attack': return `${pct}% chance of successful transition`;
    case 'Momentum swing to home': return `Home gains ${Math.round(weight * 40)}% momentum boost`;
    case 'Momentum swing to away': return `Away gains ${Math.round(weight * 40)}% momentum boost`;
    case 'Breaks defensive line': return `Opens space for ${Math.round(weight * 60)}% better attack`;
    case 'Build-up play': return `Contributes to sustained ${pct}% possession pressure`;
    case 'Kills attack': return `Neutralizes threat, ${Math.round((1 - weight) * 100)}% reset`;
    default: return `Neutral play continuation at ${pct}% success rate`;
  }
}

export function pickRandomEvent(): EventType {
  // Weighted random: passes most common
  const weights = [25, 10, 6, 8, 7, 5, 8, 5, 4, 5]; // roughly matches real football
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < EVENT_TYPES.length; i++) {
    r -= weights[i];
    if (r <= 0) return EVENT_TYPES[i];
  }
  return 'Pass';
}

export function pickRandomZone(): ZoneId {
  return ZONES[Math.floor(Math.random() * ZONES.length)].id;
}

export function pickRandomSignificance(eventType: EventType): SignificanceType {
  // Context-aware random significance
  if (eventType === 'Shot') {
    const opts: SignificanceType[] = ['High goal-scoring chance', 'No shift', 'Momentum swing to home', 'Kills attack'];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  if (eventType === 'Tackle' || eventType === 'Clearance') {
    const opts: SignificanceType[] = ['Kills attack', 'Creates counter-attack', 'No shift', 'Momentum swing to home'];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  const common: SignificanceType[] = ['No shift', 'Build-up play', 'Creates counter-attack', 'Breaks defensive line', 'Momentum swing to home', 'Momentum swing to away'];
  return common[Math.floor(Math.random() * common.length)];
}

export function createInitialState(): MatchState {
  return {
    minute: 0,
    homeScore: 1,
    awayScore: 0,
    half: 1,
    events: [],
    momentum: 0.15,
    isRunning: false,
    selectedZone: 'mid-center',
  };
}
