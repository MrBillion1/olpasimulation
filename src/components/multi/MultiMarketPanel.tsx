import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { MARKETS } from '@/lib/match-engine';
import { DraftContract, computeDraft } from '@/lib/portfolio-math';
import { portfolioActions } from '@/lib/portfolio-store';
import PortfolioConfirmModal from './PortfolioConfirmModal';
import TpSlEducationCard from './TpSlEducationCard';

interface Props {
  balance: number;
}

const MAX_CONTRACTS = 5;

const defaultDraft = (id: string): DraftContract => {
  const m = MARKETS.find(x => x.id === id) ?? MARKETS[0];
  return {
    contractId: m.id, contract: m.contract.split('/')[0],
    direction: 'long', leverage: 5, tpPct: 50, slPct: 10,
  };
};

export default function MultiMarketPanel({ balance }: Props) {
  const [name, setName] = useState('Weekend Convictions');
  const [margin, setMargin] = useState(Math.min(100, Math.floor(balance)));
  const [drafts, setDrafts] = useState<DraftContract[]>([defaultDraft(MARKETS[0].id)]);
  const [confirming, setConfirming] = useState(false);

  const calc = computeDraft(drafts, margin);
  const canSubmit = drafts.length > 0 && margin > 0 && margin <= balance;

  const updateDraft = (idx: number, patch: Partial<DraftContract>) => {
    setDrafts(d => d.map((c, i) => i === idx ? { ...c, ...patch } : c));
  };

  const addContract = () => {
    if (drafts.length >= MAX_CONTRACTS) return;
    const used = new Set(drafts.map(d => d.contractId));
    const next = MARKETS.find(m => !used.has(m.id)) ?? MARKETS[0];
    setDrafts(d => [...d, defaultDraft(next.id)]);
  };

  const removeContract = (idx: number) => {
    setDrafts(d => d.filter((_, i) => i !== idx));
  };

  const onConfirm = () => {
    const p = portfolioActions.open(name, margin, drafts);
    if (p) {
      setConfirming(false);
      // reset draft to a fresh single-contract starter
      setDrafts([defaultDraft(MARKETS[0].id)]);
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-widest text-gold font-semibold">Portfolio Builder</h3>
          <span className="text-[9px] text-muted-foreground font-mono">Avail ${balance.toFixed(2)}</span>
        </div>

        {/* Name + margin */}
        <div className="space-y-1.5">
          <div>
            <label className="text-[8px] uppercase tracking-wider text-muted-foreground block mb-0.5">Portfolio Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={32}
              className="w-full bg-secondary border border-border rounded px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-gold"
            />
          </div>
          <div>
            <label className="text-[8px] uppercase tracking-wider text-muted-foreground block mb-0.5">
              Portfolio Margin: ${margin}
            </label>
            <input
              type="range"
              min={10}
              max={Math.max(10, Math.floor(balance))}
              step={10}
              value={Math.min(margin, Math.max(10, Math.floor(balance)))}
              onChange={e => setMargin(Number(e.target.value))}
              className="w-full accent-[hsl(var(--gold))] h-1"
            />
          </div>
        </div>
      </div>

      {/* Contracts */}
      <div className="bg-card border border-border rounded-lg p-2 space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">
            Contracts {drafts.length}/{MAX_CONTRACTS}
          </span>
          <button
            onClick={addContract}
            disabled={drafts.length >= MAX_CONTRACTS}
            className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-gold font-bold px-2 py-0.5 border border-gold/40 rounded hover:bg-gold/10 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {drafts.map((c, i) => (
          <ContractRow
            key={i}
            draft={c}
            margin={calc.margins[i] ?? 0}
            exposure={calc.exposures[i] ?? 0}
            weight={calc.weights[i] ?? 0}
            canRemove={drafts.length > 1}
            onChange={patch => updateDraft(i, patch)}
            onRemove={() => removeContract(i)}
          />
        ))}
      </div>

      {/* Live calculator */}
      <div className="bg-secondary/40 border border-border rounded-lg p-2 grid grid-cols-2 gap-1.5 text-[10px] font-mono">
        <Calc label="Exposure" value={`$${calc.totalExposure.toFixed(2)}`} />
        <Calc label="Eff. Lev" value={`${calc.effectiveLeverage.toFixed(2)}x`} />
        <Calc label="Target Payout" value={`+$${calc.targetPayout.toFixed(2)}`} tone="accent" />
        <Calc label="Max Drawdown" value={`-$${calc.maxDrawdown.toFixed(2)}`} tone="destructive" />
        <Calc label="Reward / Risk" value={calc.rewardRisk.toFixed(2)} />
        <Calc label="Conviction" value={`${calc.convictionScore}`} />
      </div>

      <TpSlEducationCard />

      <button
        onClick={() => setConfirming(true)}
        disabled={!canSubmit}
        className="w-full bg-gold text-primary-foreground font-bold text-[11px] py-2.5 rounded uppercase tracking-wider hover:brightness-110 active:scale-[0.98] disabled:opacity-40 transition-all"
      >
        Review &amp; Open Portfolio
      </button>

      {confirming && (
        <PortfolioConfirmModal
          name={name}
          margin={margin}
          contracts={drafts}
          onCancel={() => setConfirming(false)}
          onConfirm={onConfirm}
        />
      )}
    </div>
  );
}

function Calc({ label, value, tone }: { label: string; value: string; tone?: 'accent' | 'destructive' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'destructive' ? 'text-destructive' : 'text-foreground';
  return (
    <div className="flex items-center justify-between px-1.5 py-1 bg-secondary/30 rounded">
      <span className="text-[8px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function ContractRow({
  draft, margin, exposure, weight, canRemove, onChange, onRemove,
}: {
  draft: DraftContract;
  margin: number;
  exposure: number;
  weight: number;
  canRemove: boolean;
  onChange: (p: Partial<DraftContract>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="bg-secondary/30 border border-border rounded p-2 space-y-1.5">
      <div className="flex items-center gap-1.5">
        <select
          value={draft.contractId}
          onChange={e => {
            const m = MARKETS.find(x => x.id === e.target.value);
            if (m) onChange({ contractId: m.id, contract: m.contract.split('/')[0] });
          }}
          className="flex-1 bg-background border border-border rounded px-1.5 py-1 text-[10px] font-mono font-bold focus:outline-none focus:border-gold"
        >
          {MARKETS.map(m => (
            <option key={m.id} value={m.id}>{m.contract.split('/')[0]}</option>
          ))}
        </select>
        <div className="flex gap-0.5">
          {(['long', 'short'] as const).map(d => (
            <button
              key={d}
              onClick={() => onChange({ direction: d })}
              className={`text-[9px] px-2 py-1 rounded font-bold uppercase ${
                draft.direction === d
                  ? d === 'long' ? 'bg-accent text-accent-foreground' : 'bg-destructive text-destructive-foreground'
                  : 'bg-secondary text-muted-foreground'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
        {canRemove && (
          <button onClick={onRemove} className="text-muted-foreground hover:text-destructive p-1">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Leverage */}
      <div>
        <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-muted-foreground">
          <span>Leverage</span>
          <span className="text-foreground font-mono font-bold">{draft.leverage}x</span>
        </div>
        <input
          type="range" min={1} max={20} step={1}
          value={draft.leverage}
          onChange={e => onChange({ leverage: Number(e.target.value) })}
          className="w-full accent-[hsl(var(--gold))] h-1"
        />
      </div>

      {/* TP / SL */}
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-muted-foreground">
            <span>TP</span>
            <span className="text-accent font-mono font-bold">+{draft.tpPct}%</span>
          </div>
          <input
            type="range" min={5} max={200} step={5}
            value={draft.tpPct}
            onChange={e => onChange({ tpPct: Number(e.target.value) })}
            className="w-full accent-[hsl(var(--accent))] h-1"
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-[8px] uppercase tracking-wider text-muted-foreground">
            <span>SL</span>
            <span className="text-destructive font-mono font-bold">-{draft.slPct}%</span>
          </div>
          <input
            type="range" min={1} max={50} step={1}
            value={draft.slPct}
            onChange={e => onChange({ slPct: Number(e.target.value) })}
            className="w-full accent-destructive h-1"
          />
        </div>
      </div>

      {/* Allocation visual */}
      <div className="space-y-0.5">
        <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground">
          <span>Alloc {(weight * 100).toFixed(1)}%</span>
          <span>${margin.toFixed(2)} → ${exposure.toFixed(2)}</span>
        </div>
        <div className="h-1 bg-secondary rounded overflow-hidden">
          <div className="h-full bg-gold" style={{ width: `${weight * 100}%` }} />
        </div>
      </div>
    </div>
  );
}
