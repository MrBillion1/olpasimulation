// Deterministic NPC analyst voices — generated in reaction to material match events.
// These are simulated participants; their handles are clearly institutional/analyst-style,
// not fan/influencer. Posts are seeded from event id so they're stable across renders.

import { MARKETS, MatchEvent } from '@/lib/match-engine';
import { actions, getState, subscribe, SocialPost, OpenTrade } from '@/lib/simulation-store';
import { toPublicConviction } from '@/lib/conviction';

const NPC_AUTHORS = [
  { id: 'npc-helix',     name: 'Helix Research',        handle: '@helix.desk',     bias: 'volatility' as const },
  { id: 'npc-stratos',   name: 'Stratos Capital',       handle: '@stratos',        bias: 'macro' as const },
  { id: 'npc-orderflow', name: 'Orderflow Lab',         handle: '@orderflow',      bias: 'flow' as const },
  { id: 'npc-pitch',     name: 'PitchModel',            handle: '@pitchmodel',     bias: 'tactical' as const },
  { id: 'npc-tape',      name: 'TapeReader',            handle: '@tapereader',     bias: 'momentum' as const },
  { id: 'npc-nodal',     name: 'Nodal Quant',           handle: '@nodal.q',        bias: 'tactical' as const },
  { id: 'npc-edge',      name: 'EdgeStation',           handle: '@edgestation',    bias: 'flow' as const },
  { id: 'npc-vega',      name: 'Vega Desk',             handle: '@vega.desk',      bias: 'volatility' as const },
];

// seeded PRNG so the same event always maps to the same author/template
function seeded(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return ((h >>> 0) / 0xffffffff);
}

function pick<T>(arr: T[], r: number): T { return arr[Math.floor(r * arr.length) % arr.length]; }

const TEMPLATES: Record<string, ((ctx: { home: string; away: string; team: string; minute: number; weight: number }) => string)[]> = {
  Goal: [
    ({ team, minute, weight }) => `${team} converts. ${minute}' — pricing engine repriced ${(weight * 100).toFixed(0)}% on conversion. Watching the rebound.`,
    ({ team, minute }) => `Goal ${team}, ${minute}'. Crowd positioning will lag by ~30s; expect re-flow into the new mid.`,
    ({ team }) => `${team} take the lead. This is the regime shift the orderbook was front-running for two minutes.`,
  ],
  'Red Card': [
    ({ team, minute }) => `Red against ${team} at ${minute}'. Numerical disadvantage — model marks down expected possession share.`,
    ({ team }) => `${team} reduced to ten. Volatility persistence elevated — wider spreads warranted.`,
  ],
  Penalty: [
    ({ team, minute, weight }) => `Penalty awarded to ${team} at ${minute}'. Conversion-weighted mark moved ${(weight * 100).toFixed(0)}%.`,
    ({ team }) => `Spot kick for ${team}. Liquidity will thin around the strike — patient orders only.`,
  ],
  'VAR Review': [
    ({ minute }) => `VAR halt at ${minute}'. Pricing engine in Penda mode — book frozen. No fills.`,
    () => `Review on the field. Reality is being audited; the price waits.`,
  ],
  'Counter Attack': [
    ({ team, minute }) => `${team} on the counter, ${minute}'. Through-ball geometry suggests asymmetric upside.`,
  ],
  'Shot on Target': [
    ({ team, weight }) => `${team} forces the keeper. xG-weighted move: ${(weight * 100).toFixed(0)}%. Building pressure.`,
  ],
  'Yellow Card': [
    ({ team, minute }) => `${team} booked at ${minute}'. Discipline cost rising — flag for late-match risk.`,
  ],
  'Substitution': [
    ({ team, minute }) => `${team} subs at ${minute}'. Tactical shift incoming — re-baseline momentum after next 5'.`,
  ],
};

function buildPostFromEvent(marketId: string, ev: MatchEvent): SocialPost | null {
  const market = MARKETS.find(m => m.id === marketId);
  if (!market) return null;
  const templates = TEMPLATES[ev.type];
  if (!templates) return null; // only react to material event types

  const seed = ev.id;
  const r1 = seeded(seed);
  const r2 = seeded(seed + ':2');
  const r3 = seeded(seed + ':3');

  // Sometimes skip — not every material event spawns chatter
  if (r1 > 0.55 && ev.impact !== 'high') return null;
  if (r1 > 0.85) return null;

  const author = pick(NPC_AUTHORS, r2);
  const tpl = pick(templates, r3);
  const teamName = ev.team === 'home' ? market.homeTeam : market.awayTeam;
  const body = tpl({ home: market.homeTeam, away: market.awayTeam, team: teamName, minute: ev.minute, weight: ev.weight.final });

  const rt = getState().runtimes[marketId];
  return {
    id: `npc-${ev.id}`,
    authorId: author.id,
    authorName: author.name,
    authorHandle: author.handle,
    isNpc: true,
    isSelf: false,
    marketId,
    contract: market.contract,
    body,
    createdAt: Date.now(),
    matchMinuteAtPost: ev.minute,
    priceAtPost: rt?.currentPrice ?? market.startPrice,
    reactions: { agree: 0, disagree: 0, fade: 0 },
  };
}

let prevCounters: Record<string, number> = {};
let installed = false;

export function installNpcEngine() {
  if (installed) return;
  installed = true;
  // initialize cursors
  const s0 = getState();
  MARKETS.forEach(m => { prevCounters[m.id] = s0.runtimes[m.id].state.events.length; });

  subscribe(() => {
    const s = getState();
    const newPosts: SocialPost[] = [];
    MARKETS.forEach(m => {
      const evs = s.runtimes[m.id].state.events;
      const prev = prevCounters[m.id] ?? 0;
      if (evs.length > prev) {
        for (let i = prev; i < evs.length; i++) {
          const post = buildPostFromEvent(m.id, evs[i]);
          if (post) newPosts.push(post);
        }
        prevCounters[m.id] = evs.length;
      }
    });
    if (newPosts.length > 0) {
      // batch-add (newest first)
      newPosts.reverse().forEach(p => actions.addPost(p));
    }
  });
}

// Seed initial pre-match analyst posts so a fresh hub is never empty.
export function seedInitialPosts() {
  const s = getState();
  if (s.posts.length > 0) return;
  MARKETS.forEach((m, idx) => {
    const author = NPC_AUTHORS[idx % NPC_AUTHORS.length];
    actions.addPost({
      authorId: author.id,
      authorName: author.name,
      authorHandle: author.handle,
      isNpc: true,
      isSelf: false,
      marketId: m.id,
      contract: m.contract,
      body: `Pre-match read on ${m.homeTeam} vs ${m.awayTeam}: scenario tag ${m.scenario}. Opening at $${m.startPrice.toFixed(4)}. Watching first-15 flow for regime confirmation.`,
      createdAt: Date.now() - (idx + 1) * 60_000,
      matchMinuteAtPost: 0,
      priceAtPost: m.startPrice,
    });
  });
}
