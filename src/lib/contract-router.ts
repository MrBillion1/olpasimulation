// Auto-detect which contract a free-text post belongs to.
// Maintains a deterministic alias map per market — case-insensitive, word-boundary aware.

import { MARKETS, MarketConfig } from '@/lib/match-engine';

interface AliasRule {
  market: MarketConfig;
  patterns: RegExp[];
}

// Per-market alias keywords. Includes team names, short codes, contract symbol,
// historical fixture monikers (El Clasico, Derby della Madonnina, Le Classique, etc.)
const ALIASES: Record<string, string[]> = {
  mcimun:  ['mcimun', 'man city', 'manchester city', 'mci', 'mcfc', 'man united', 'manchester united', 'man utd', 'mufc', 'mun', 'manchester derby'],
  rmabar:  ['rmabar', 'real madrid', 'rma', 'madrid', 'merengues', 'barcelona', 'barca', 'fcb', 'bar', 'el clasico', 'el clásico', 'clasico'],
  acmint:  ['acmint', 'ac milan', 'milan', 'acm', 'rossoneri', 'inter', 'inter milan', 'internazionale', 'nerazzurri', 'derby della madonnina', 'derby milano'],
  psgmar:  ['psgmar', 'psg', 'paris', 'paris saint-germain', 'paris sg', 'marseille', 'om', 'mar', 'le classique', 'le classico'],
  arstot:  ['arstot', 'arsenal', 'ars', 'gunners', 'tottenham', 'spurs', 'tot', 'thfc', 'north london derby'],
  fcbbvb:  ['fcbbvb', 'bayern', 'bayern munich', 'fc bayern', 'fcb', 'dortmund', 'bvb', 'borussia dortmund', 'der klassiker', 'klassiker'],
};

const RULES: AliasRule[] = MARKETS.map(m => ({
  market: m,
  patterns: (ALIASES[m.id] ?? []).map(a => new RegExp(`(^|[^a-z0-9])${escapeRegex(a)}([^a-z0-9]|$)`, 'i')),
}));

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function detectContract(text: string): MarketConfig | null {
  if (!text.trim()) return null;
  const lower = ` ${text.toLowerCase()} `;
  // Score each rule by number of distinct alias matches; pick highest.
  let best: { rule: AliasRule; score: number } | null = null;
  for (const rule of RULES) {
    let score = 0;
    for (const pat of rule.patterns) {
      if (pat.test(lower)) score++;
    }
    if (score > 0 && (!best || score > best.score)) best = { rule, score };
  }
  return best?.rule.market ?? null;
}

export function detectContractIds(text: string): string[] {
  const lower = ` ${text.toLowerCase()} `;
  return RULES
    .filter(r => r.patterns.some(p => p.test(lower)))
    .map(r => r.market.id);
}
