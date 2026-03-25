// ============= Match Engine Types & Logic =============

export type ZoneId = 
  | 'def-left' | 'def-center' | 'def-right'
  | 'mid-left' | 'mid-center' | 'mid-right'
  | 'att-left' | 'att-center' | 'att-right';

export type ImpactTier = 'high' | 'medium' | 'low';

export type EventType = 
  | 'Goal' | 'Red Card' | 'Penalty' | 'Own Goal'
  | 'Shot on Target' | 'Corner' | 'Free Kick' | 'Yellow Card' | 'Offside'
  | 'Pass' | 'Tackle' | 'Dribble' | 'Substitution' | 'Clearance' | 'Cross'
  | 'Long Ball' | 'Foul' | 'Save' | 'Header' | 'Throw-in' | 'Goal Kick'
  | 'VAR Review' | 'Interception' | 'Block' | 'Aerial Duel' | 'Key Pass'
  | 'Through Ball' | 'Handball' | 'Injury' | 'Time Wasting' | 'Counter Attack';

export type SignificanceType = 
  | 'No shift' | 'Build-up play' | 'Creates counter-attack' 
  | 'Momentum swing to home' | 'Momentum swing to away'
  | 'High goal-scoring chance' | 'Breaks defensive line' | 'Kills attack'
  | 'Game-changing moment' | 'Tactical adjustment'
  | 'VAR halt — Penda mode active';

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
  impact: ImpactTier;
  emoji: string;
}

export interface MatchState {
  minute: number;
  homeScore: number;
  awayScore: number;
  half: 1 | 2;
  events: MatchEvent[];
  momentum: number;
  isRunning: boolean;
  selectedZone: ZoneId;
  varActive: boolean;
  varMinutesLeft: number;
}

export interface MarketConfig {
  id: string;
  contract: string;
  homeTeam: string;
  awayTeam: string;
  homeShort: string;
  awayShort: string;
  homeColor: string;
  awayColor: string;
  startPrice: number;
  scenario: 'balanced' | 'home-dominant' | 'away-dominant' | 'chaotic' | 'tactical' | 'high-press';
  homePlayers: string[];
  awayPlayers: string[];
}

export const MARKETS: MarketConfig[] = [
  {
    id: 'mcimun', contract: 'MCIMUN/USDT',
    homeTeam: 'Man City', awayTeam: 'Man United',
    homeShort: 'MCI', awayShort: 'MUN',
    homeColor: 'hsl(200, 70%, 55%)', awayColor: 'hsl(0, 68%, 50%)',
    startPrice: 1.85,
    scenario: 'balanced',
    homePlayers: ['De Bruyne', 'Haaland', 'Foden', 'Bernardo', 'Rodri', 'Walker', 'Stones', 'Dias', 'Grealish', 'Doku', 'Ederson'],
    awayPlayers: ['Fernandes', 'Rashford', 'Garnacho', 'Mainoo', 'Casemiro', 'Shaw', 'Martínez', 'Varane', 'Mount', 'Højlund', 'Onana'],
  },
  {
    id: 'rmabar', contract: 'RMABAR/USDT',
    homeTeam: 'Real Madrid', awayTeam: 'Barcelona',
    homeShort: 'RMA', awayShort: 'BAR',
    homeColor: 'hsl(0, 0%, 95%)', awayColor: 'hsl(220, 80%, 45%)',
    startPrice: 2.35,
    scenario: 'home-dominant',
    homePlayers: ['Bellingham', 'Vinícius Jr', 'Mbappé', 'Valverde', 'Modric', 'Tchouaméni', 'Carvajal', 'Rüdiger', 'Alaba', 'Mendy', 'Courtois'],
    awayPlayers: ['Pedri', 'Yamal', 'Lewandowski', 'Gavi', 'De Jong', 'Raphinha', 'Araújo', 'Koundé', 'Balde', 'Christensen', 'Ter Stegen'],
  },
  {
    id: 'acmint', contract: 'ACMINT/USDT',
    homeTeam: 'AC Milan', awayTeam: 'Inter Milan',
    homeShort: 'ACM', awayShort: 'INT',
    homeColor: 'hsl(0, 68%, 42%)', awayColor: 'hsl(220, 60%, 40%)',
    startPrice: 1.20,
    scenario: 'away-dominant',
    homePlayers: ['Leão', 'Giroud', 'Pulisic', 'Reijnders', 'Loftus-Cheek', 'Bennacer', 'Hernández', 'Tomori', 'Thiaw', 'Calabria', 'Maignan'],
    awayPlayers: ['Lautaro', 'Thuram', 'Barella', 'Çalhanoğlu', 'Mkhitaryan', 'Dimarco', 'Bastoni', 'Acerbi', 'Pavard', 'Dumfries', 'Sommer'],
  },
  {
    id: 'psgmar', contract: 'PSGMAR/USDT',
    homeTeam: 'PSG', awayTeam: 'Marseille',
    homeShort: 'PSG', awayShort: 'MAR',
    homeColor: 'hsl(230, 60%, 45%)', awayColor: 'hsl(195, 80%, 50%)',
    startPrice: 1.95,
    scenario: 'chaotic',
    homePlayers: ['Dembélé', 'Kolo Muani', 'Barcola', 'Vitinha', 'Zaïre-Emery', 'Hakimi', 'Marquinhos', 'Skriniar', 'Nuno Mendes', 'Ugarte', 'Donnarumma'],
    awayPlayers: ['Aubameyang', 'Ünder', 'Sanchez', 'Guendouzi', 'Rongier', 'Clauss', 'Balerdi', 'Mbemba', 'Murillo', 'Ndiaye', 'Pau López'],
  },
  {
    id: 'arstot', contract: 'ARSTOT/USDT',
    homeTeam: 'Arsenal', awayTeam: 'Tottenham',
    homeShort: 'ARS', awayShort: 'TOT',
    homeColor: 'hsl(0, 68%, 48%)', awayColor: 'hsl(0, 0%, 90%)',
    startPrice: 2.10,
    scenario: 'high-press',
    homePlayers: ['Saka', 'Ødegaard', 'Rice', 'Havertz', 'Saliba', 'Gabriel', 'White', 'Zinchenko', 'Trossard', 'Martinelli', 'Raya'],
    awayPlayers: ['Son', 'Maddison', 'Kulusevski', 'Bissouma', 'Romero', 'Van de Ven', 'Porro', 'Udogie', 'Richarlison', 'Johnson', 'Vicario'],
  },
  {
    id: 'fcbbvb', contract: 'FCBBVB/USDT',
    homeTeam: 'Bayern Munich', awayTeam: 'Dortmund',
    homeShort: 'FCB', awayShort: 'BVB',
    homeColor: 'hsl(0, 68%, 42%)', awayColor: 'hsl(50, 95%, 50%)',
    startPrice: 0.95,
    scenario: 'tactical',
    homePlayers: ['Musiala', 'Sané', 'Kane', 'Kimmich', 'Müller', 'Goretzka', 'Davies', 'Upamecano', 'Kim', 'Mazraoui', 'Neuer'],
    awayPlayers: ['Sancho', 'Adeyemi', 'Füllkrug', 'Brandt', 'Sabitzer', 'Can', 'Ryerson', 'Hummels', 'Schlotterbeck', 'Maatsen', 'Kobel'],
  },
];

export const POSITIVE_EVENTS: Set<EventType> = new Set([
  'Goal', 'Shot on Target', 'Corner', 'Free Kick', 'Penalty',
  'Pass', 'Dribble', 'Cross', 'Header', 'Long Ball', 'Save', 'Tackle', 'Clearance',
  'Interception', 'Block', 'Aerial Duel', 'Key Pass', 'Through Ball', 'Counter Attack',
]);

export const NEGATIVE_EVENTS: Set<EventType> = new Set([
  'Red Card', 'Own Goal', 'Yellow Card', 'Foul', 'Offside', 'Handball', 'Time Wasting',
]);

export function getEventSentiment(type: EventType): 'positive' | 'negative' | 'neutral' {
  if (POSITIVE_EVENTS.has(type)) return 'positive';
  if (NEGATIVE_EVENTS.has(type)) return 'negative';
  return 'neutral';
}

export const EVENT_META: Record<EventType, { base: number; impact: ImpactTier; emoji: string }> = {
  'Goal':            { base: 0.28, impact: 'high',   emoji: '⚽' },
  'Red Card':        { base: 0.15, impact: 'high',   emoji: '🟥' },
  'Penalty':         { base: 0.30, impact: 'high',   emoji: '⚠️' },
  'Own Goal':        { base: 0.12, impact: 'high',   emoji: '⚽' },
  'VAR Review':      { base: 0.20, impact: 'high',   emoji: '📺' },
  'Shot on Target':  { base: 0.42, impact: 'medium', emoji: '🎯' },
  'Corner':          { base: 0.72, impact: 'medium', emoji: '📐' },
  'Free Kick':       { base: 0.55, impact: 'medium', emoji: '🦶' },
  'Yellow Card':     { base: 0.80, impact: 'low',    emoji: '🟨' },
  'Offside':         { base: 0.65, impact: 'low',    emoji: '🚩' },
  'Pass':            { base: 0.88, impact: 'low',    emoji: '➡️' },
  'Tackle':          { base: 0.68, impact: 'medium', emoji: '🦵' },
  'Dribble':         { base: 0.58, impact: 'medium', emoji: '💨' },
  'Substitution':    { base: 0.95, impact: 'low',    emoji: '🔄' },
  'Clearance':       { base: 0.78, impact: 'low',    emoji: '🧹' },
  'Cross':           { base: 0.45, impact: 'medium', emoji: '↗️' },
  'Long Ball':       { base: 0.40, impact: 'low',    emoji: '🏈' },
  'Foul':            { base: 0.70, impact: 'low',    emoji: '✋' },
  'Save':            { base: 0.55, impact: 'medium', emoji: '🧤' },
  'Header':          { base: 0.38, impact: 'medium', emoji: '🗣️' },
  'Throw-in':        { base: 0.92, impact: 'low',    emoji: '🤾' },
  'Goal Kick':       { base: 0.90, impact: 'low',    emoji: '👟' },
  'Interception':    { base: 0.72, impact: 'medium', emoji: '🫳' },
  'Block':           { base: 0.70, impact: 'medium', emoji: '🛡️' },
  'Aerial Duel':     { base: 0.50, impact: 'medium', emoji: '⬆️' },
  'Key Pass':        { base: 0.35, impact: 'medium', emoji: '🔑' },
  'Through Ball':    { base: 0.32, impact: 'medium', emoji: '⚡' },
  'Handball':        { base: 0.25, impact: 'high',   emoji: '🤚' },
  'Injury':          { base: 0.60, impact: 'low',    emoji: '🏥' },
  'Time Wasting':    { base: 0.85, impact: 'low',    emoji: '⏰' },
  'Counter Attack':  { base: 0.30, impact: 'high',   emoji: '🚀' },
};

export const EVENT_TYPES: EventType[] = Object.keys(EVENT_META) as EventType[];

export const HIGH_IMPACT_EVENTS: EventType[] = EVENT_TYPES.filter(e => EVENT_META[e].impact === 'high');
export const MEDIUM_IMPACT_EVENTS: EventType[] = EVENT_TYPES.filter(e => EVENT_META[e].impact === 'medium');
export const LOW_IMPACT_EVENTS: EventType[] = EVENT_TYPES.filter(e => EVENT_META[e].impact === 'low');

export const SIGNIFICANCE_TYPES: SignificanceType[] = [
  'No shift', 'Build-up play', 'Creates counter-attack',
  'Momentum swing to home', 'Momentum swing to away',
  'High goal-scoring chance', 'Breaks defensive line', 'Kills attack',
  'Game-changing moment', 'Tactical adjustment', 'VAR halt — Penda mode active',
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
    'Goal': -0.15, 'Red Card': 0.05, 'Penalty': -0.20, 'Own Goal': 0.10,
    'Shot on Target': -0.25, 'Corner': -0.10, 'Free Kick': -0.05,
    'Pass': 0.10, 'Tackle': 0.15, 'Dribble': -0.10,
    'Cross': -0.15, 'Long Ball': 0.05, 'Clearance': 0.20, 'Foul': 0.10,
    'Save': 0.15, 'Header': -0.10, 'Yellow Card': 0.05, 'Offside': 0.00,
    'Substitution': 0.00, 'Throw-in': 0.00, 'Goal Kick': 0.05, 'VAR Review': 0.00,
    'Interception': 0.15, 'Block': 0.18, 'Aerial Duel': 0.05, 'Key Pass': -0.15,
    'Through Ball': -0.20, 'Handball': 0.10, 'Injury': 0.00, 'Time Wasting': 0.05,
    'Counter Attack': 0.15,
  },
  'mid': {
    'Goal': -0.05, 'Red Card': 0.00, 'Penalty': -0.10, 'Own Goal': 0.00,
    'Shot on Target': -0.10, 'Corner': 0.05, 'Free Kick': 0.05,
    'Pass': 0.05, 'Tackle': 0.05, 'Dribble': 0.10,
    'Cross': 0.05, 'Long Ball': 0.10, 'Clearance': 0.00, 'Foul': 0.00,
    'Save': -0.05, 'Header': 0.05, 'Yellow Card': 0.00, 'Offside': 0.00,
    'Substitution': 0.00, 'Throw-in': 0.00, 'Goal Kick': 0.00, 'VAR Review': 0.00,
    'Interception': 0.08, 'Block': 0.05, 'Aerial Duel': 0.08, 'Key Pass': 0.10,
    'Through Ball': 0.05, 'Handball': 0.00, 'Injury': 0.00, 'Time Wasting': 0.00,
    'Counter Attack': 0.10,
  },
  'att': {
    'Goal': 0.20, 'Red Card': -0.05, 'Penalty': 0.25, 'Own Goal': -0.05,
    'Shot on Target': 0.25, 'Corner': 0.15, 'Free Kick': 0.15,
    'Pass': -0.05, 'Tackle': -0.10, 'Dribble': 0.15,
    'Cross': 0.20, 'Long Ball': -0.10, 'Clearance': -0.20, 'Foul': -0.05,
    'Save': -0.15, 'Header': 0.20, 'Yellow Card': -0.05, 'Offside': 0.05,
    'Substitution': 0.00, 'Throw-in': 0.00, 'Goal Kick': -0.05, 'VAR Review': 0.10,
    'Interception': -0.05, 'Block': -0.10, 'Aerial Duel': 0.12, 'Key Pass': 0.25,
    'Through Ball': 0.20, 'Handball': 0.15, 'Injury': 0.00, 'Time Wasting': -0.05,
    'Counter Attack': 0.20,
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
  'Game-changing moment': 0.35,
  'Tactical adjustment': 0.05,
  'VAR halt — Penda mode active': 0.00,
};

export function getZoneModifier(zone: ZoneId, eventType: EventType): number {
  const zoneGroup = zone.startsWith('def') ? 'def' : zone.startsWith('mid') ? 'mid' : 'att';
  return ZONE_MODIFIERS[zoneGroup]?.[eventType] ?? 0;
}

export function getTimeModifier(minute: number, eventType: EventType): number {
  const meta = EVENT_META[eventType];
  if (minute <= 15) {
    return meta.impact === 'high' ? -0.05 : -0.08;
  } else if (minute >= 85) {
    return meta.impact === 'high' ? 0.25 : 0.10;
  } else if (minute >= 75) {
    if (meta.impact === 'high') return 0.15;
    if (meta.impact === 'medium') return 0.05;
    return -0.05;
  } else if (minute >= 40 && minute <= 48) {
    return 0.08;
  }
  return 0;
}

export function calculateWeight(
  eventType: EventType, zone: ZoneId, significance: SignificanceType, minute: number
): WeightBreakdown {
  const base = EVENT_META[eventType].base;
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
    case 'Game-changing moment': return `Match dynamics shift dramatically — ${pct}% impact`;
    case 'Tactical adjustment': return `Minor tactical shift, ${pct}% continuation`;
    case 'VAR halt — Penda mode active': return `⏸ Match halted for VAR review — Penda adaptive mode active. All markets frozen.`;
    default: return `Neutral play continuation at ${pct}% success rate`;
  }
}

export function pickRandomEvent(scenario: MarketConfig['scenario'], minute: number): EventType {
  let weights: [EventType, number][] = [
    ['Pass', 20], ['Tackle', 7], ['Foul', 6], ['Throw-in', 5], ['Goal Kick', 4],
    ['Clearance', 5], ['Long Ball', 4], ['Yellow Card', 3], ['Offside', 3],
    ['Substitution', 2],
    ['Shot on Target', 5], ['Corner', 5], ['Free Kick', 4], ['Cross', 5],
    ['Dribble', 6], ['Save', 3], ['Header', 4],
    ['Goal', 2], ['Red Card', 0.5], ['Penalty', 1], ['Own Goal', 0.3],
    ['Interception', 5], ['Block', 4], ['Aerial Duel', 3], ['Key Pass', 3],
    ['Through Ball', 2], ['Handball', 0.3], ['Injury', 1], ['Time Wasting', 1.5],
    ['Counter Attack', 2.5],
  ];

  if (scenario === 'chaotic') {
    weights = weights.map(([t, w]) => {
      if (t === 'Goal') return [t, w * 2.2];
      if (t === 'Red Card') return [t, w * 3];
      if (t === 'Foul') return [t, w * 2];
      if (t === 'Yellow Card') return [t, w * 2];
      if (t === 'Penalty') return [t, w * 2.5];
      if (t === 'Counter Attack') return [t, w * 2];
      return [t, w];
    });
  } else if (scenario === 'home-dominant') {
    weights = weights.map(([t, w]) => {
      if (t === 'Shot on Target') return [t, w * 1.5];
      if (t === 'Corner') return [t, w * 1.3];
      if (t === 'Dribble') return [t, w * 1.3];
      if (t === 'Key Pass') return [t, w * 1.5];
      return [t, w];
    });
  } else if (scenario === 'away-dominant') {
    weights = weights.map(([t, w]) => {
      if (t === 'Clearance') return [t, w * 1.5];
      if (t === 'Save') return [t, w * 1.8];
      if (t === 'Tackle') return [t, w * 1.3];
      if (t === 'Counter Attack') return [t, w * 1.8];
      return [t, w];
    });
  } else if (scenario === 'high-press') {
    weights = weights.map(([t, w]) => {
      if (t === 'Interception') return [t, w * 2];
      if (t === 'Tackle') return [t, w * 1.8];
      if (t === 'Through Ball') return [t, w * 1.5];
      if (t === 'Counter Attack') return [t, w * 1.5];
      if (t === 'Foul') return [t, w * 1.3];
      return [t, w];
    });
  } else if (scenario === 'tactical') {
    weights = weights.map(([t, w]) => {
      if (t === 'Pass') return [t, w * 1.4];
      if (t === 'Key Pass') return [t, w * 1.8];
      if (t === 'Block') return [t, w * 1.5];
      if (t === 'Substitution') return [t, w * 1.5];
      if (t === 'Goal') return [t, w * 1.3];
      return [t, w];
    });
  }

  if (minute > 80) {
    weights = weights.map(([t, w]) => {
      if (t === 'Foul') return [t, w * 1.5];
      if (t === 'Goal') return [t, w * 1.3];
      if (t === 'Time Wasting') return [t, w * 3];
      if (t === 'Injury') return [t, w * 2];
      return [t, w];
    });
  }
  if (minute >= 44 && minute <= 47) {
    weights = weights.map(([t, w]) => {
      if (t === 'Time Wasting') return [t, w * 2];
      return [t, w];
    });
  }

  const total = weights.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of weights) {
    r -= w;
    if (r <= 0) return type;
  }
  return 'Pass';
}

export function pickTeam(scenario: MarketConfig['scenario']): 'home' | 'away' {
  switch (scenario) {
    case 'home-dominant': return Math.random() > 0.35 ? 'home' : 'away';
    case 'away-dominant': return Math.random() > 0.65 ? 'home' : 'away';
    case 'chaotic': return Math.random() > 0.5 ? 'home' : 'away';
    case 'high-press': return Math.random() > 0.45 ? 'home' : 'away';
    case 'tactical': return Math.random() > 0.48 ? 'home' : 'away';
    default: return Math.random() > 0.5 ? 'home' : 'away';
  }
}

export function pickRandomZone(): ZoneId {
  return ZONES[Math.floor(Math.random() * ZONES.length)].id;
}

export function pickRandomSignificance(eventType: EventType): SignificanceType {
  if (eventType === 'VAR Review') return 'VAR halt — Penda mode active';
  const meta = EVENT_META[eventType];
  if (meta.impact === 'high') {
    const opts: SignificanceType[] = ['Game-changing moment', 'High goal-scoring chance', 'Momentum swing to home', 'Momentum swing to away'];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  if (meta.impact === 'medium') {
    const opts: SignificanceType[] = ['Build-up play', 'Creates counter-attack', 'Breaks defensive line', 'Momentum swing to home', 'No shift'];
    return opts[Math.floor(Math.random() * opts.length)];
  }
  const opts: SignificanceType[] = ['No shift', 'Build-up play', 'Tactical adjustment', 'Kills attack'];
  return opts[Math.floor(Math.random() * opts.length)];
}

export function createInitialState(): MatchState {
  return {
    minute: 0, homeScore: 0, awayScore: 0, half: 1,
    events: [], momentum: 0, isRunning: false, selectedZone: 'mid-center',
    varActive: false, varMinutesLeft: 0,
  };
}
