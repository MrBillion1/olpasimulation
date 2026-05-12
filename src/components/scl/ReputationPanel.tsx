import { useStore } from '@/hooks/useStore';
import { buildReputation } from '@/lib/reputation';

export default function ReputationPanel() {
  const posts = useStore(s => s.posts);
  const runtimes = useStore(s => s.runtimes);
  const rep = buildReputation(posts, runtimes).slice(0, 10);

  return (
    <div className="border border-border bg-card/40 rounded-md">
      <div className="px-3 py-2 border-b border-border flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gold">Signal Quality</span>
        <span className="text-[8px] text-muted-foreground font-mono uppercase tracking-wider">No follower counts</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[9px] font-mono">
          <thead>
            <tr className="text-muted-foreground uppercase tracking-wider text-[8px]">
              <th className="text-left px-3 py-1.5">Author</th>
              <th className="text-right px-1 py-1.5">Posts</th>
              <th className="text-right px-1 py-1.5">Conv.</th>
              <th className="text-right px-1 py-1.5">Acc</th>
              <th className="text-right px-1 py-1.5">Avg ROI</th>
              <th className="text-right px-1 py-1.5">Cons.</th>
              <th className="text-right px-3 py-1.5">Upsets</th>
            </tr>
          </thead>
          <tbody>
            {rep.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-3 text-center text-muted-foreground">No settled signals yet.</td></tr>
            )}
            {rep.map(r => (
              <tr key={r.authorId} className="border-t border-border/40">
                <td className="px-3 py-1.5 text-foreground">{r.authorName}</td>
                <td className="px-1 py-1.5 text-right text-muted-foreground tabular-nums">{r.posts}</td>
                <td className="px-1 py-1.5 text-right text-muted-foreground tabular-nums">{r.withConviction}</td>
                <td className="px-1 py-1.5 text-right text-foreground tabular-nums">{(r.accuracy * 100).toFixed(0)}%</td>
                <td className={`px-1 py-1.5 text-right tabular-nums ${r.avgRoiPct >= 0 ? 'text-accent' : 'text-destructive'}`}>
                  {r.avgRoiPct >= 0 ? '+' : ''}{r.avgRoiPct.toFixed(1)}%
                </td>
                <td className="px-1 py-1.5 text-right text-muted-foreground tabular-nums">{(r.consistency * 100).toFixed(0)}</td>
                <td className="px-3 py-1.5 text-right text-gold tabular-nums">{r.upsetHits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
