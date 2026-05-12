// Performance-based reputation derived from settled posts with conviction.
// No follower count. No popularity. Signal quality only.

import type { SocialPost, ReputationEntry, MarketRuntime } from '@/lib/simulation-store';
import { computeRoiPct } from '@/lib/conviction';

export function buildReputation(posts: SocialPost[], runtimes: Record<string, MarketRuntime>): ReputationEntry[] {
  const byAuthor = new Map<string, SocialPost[]>();
  for (const p of posts) {
    if (!byAuthor.has(p.authorId)) byAuthor.set(p.authorId, []);
    byAuthor.get(p.authorId)!.push(p);
  }

  const out: ReputationEntry[] = [];
  byAuthor.forEach((list, authorId) => {
    const withConv = list.filter(p => p.conviction);
    let correct = 0, incorrect = 0, totalRoi = 0;
    const rois: number[] = [];
    let upsetHits = 0;

    for (const p of withConv) {
      const rt = runtimes[p.marketId];
      if (!rt) continue;
      const isFinal = rt.state.minute >= 90 && !rt.state.isRunning;
      const roi = computeRoiPct(p.conviction!, rt.currentPrice);
      if (isFinal) {
        rois.push(roi);
        totalRoi += roi;
        if (roi > 0) correct++; else if (roi < 0) incorrect++;
        // upset = post made before kickoff or in opening 15' AND ended correct
        if (roi > 0 && p.matchMinuteAtPost <= 15) upsetHits++;
      }
    }

    const settled = correct + incorrect;
    const accuracy = settled > 0 ? correct / settled : 0;
    const avgRoi = rois.length > 0 ? totalRoi / rois.length : 0;
    // consistency: 1 - normalized stdev (0 = chaotic, 1 = consistent)
    let consistency = 0;
    if (rois.length > 1) {
      const mean = avgRoi;
      const variance = rois.reduce((s, r) => s + (r - mean) ** 2, 0) / rois.length;
      const stdev = Math.sqrt(variance);
      consistency = Math.max(0, 1 - stdev / 20); // 20% stdev → 0
    } else if (rois.length === 1) {
      consistency = 0.5;
    }

    out.push({
      authorId,
      authorName: list[0].authorName,
      posts: list.length,
      withConviction: withConv.length,
      correct,
      incorrect,
      totalRoiPct: Math.round(totalRoi * 10) / 10,
      avgRoiPct: Math.round(avgRoi * 10) / 10,
      accuracy: Math.round(accuracy * 100) / 100,
      upsetHits,
      consistency: Math.round(consistency * 100) / 100,
    });
  });

  // Composite signal quality score: accuracy + roi + consistency + upsets
  return out.sort((a, b) => {
    const sA = a.accuracy * 50 + a.avgRoiPct * 0.5 + a.consistency * 20 + a.upsetHits * 5;
    const sB = b.accuracy * 50 + b.avgRoiPct * 0.5 + b.consistency * 20 + b.upsetHits * 5;
    return sB - sA;
  });
}
