import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Gavel, DollarSign, Clock, ShieldAlert } from 'lucide-react';
import { formatUnits } from 'ethers';

export interface AuctionNodeData {
  auctionId: string;
  loanId: string;
  borrower: string;
  principal: string;
  collateralAmount: string;
  discountBps: number;
  status: string;
  highestBid?: string;
  highestBidder?: string;
}

function formatAmount(val: any): string {
  if (!val) return '0.00';
  if (typeof val === 'string' && val.includes('.')) {
    const num = parseFloat(val);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }
  try {
    return Number(formatUnits(val, 18)).toFixed(2);
  } catch {
    const num = parseFloat(String(val));
    return isNaN(num) ? '0.00' : num.toFixed(2);
  }
}

export const AuctionNode: React.FC<{ data: AuctionNodeData; selected?: boolean }> = memo(({ data, selected }) => {
  const isSettled = data.status === 'SETTLED';
  const principalFmt = formatAmount(data.principal);
  const discountPct = (data.discountBps / 100).toFixed(0);

  return (
    <div
      className={`relative min-w-[240px] rounded-xl border p-4 shadow-xl transition-all duration-300 ${
        isSettled
          ? 'bg-slate-900/90 border-emerald-500/50 shadow-emerald-900/20'
          : 'bg-slate-900/90 border-amber-500/60 shadow-amber-900/20 ring-1 ring-amber-500/30'
      } ${selected ? 'ring-2 ring-cyan-400 scale-[1.02]' : ''}`}
      style={{
        backdropFilter: 'blur(12px)',
        background: 'linear-gradient(135deg, rgba(30, 27, 75, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-slate-900"
      />

      <div className="flex items-center justify-between gap-2 border-b border-slate-700/60 pb-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
            <Gavel className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-bold tracking-wide uppercase text-amber-300">Debt Recovery Auction</div>
            <div className="text-[10px] text-slate-400 font-mono">ID #{data.loanId}</div>
          </div>
        </div>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${
            isSettled
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse'
          }`}
        >
          {data.status}
        </span>
      </div>

      <div className="space-y-2 text-xs">
        <div className="flex justify-between items-center bg-slate-800/60 px-2.5 py-1.5 rounded-lg border border-slate-700/40">
          <span className="text-slate-400 flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-slate-400" /> Defaulted Debt
          </span>
          <span className="font-mono font-bold text-slate-100">{principalFmt} CTC</span>
        </div>

        <div className="flex justify-between items-center bg-amber-950/30 px-2.5 py-1.5 rounded-lg border border-amber-900/40">
          <span className="text-amber-300/80 flex items-center gap-1">
            <ShieldAlert className="w-3 h-3 text-amber-400" /> Recovery Discount
          </span>
          <span className="font-mono font-bold text-amber-400">-{discountPct}%</span>
        </div>

        {data.highestBid && (
          <div className="flex justify-between items-center bg-emerald-950/30 px-2.5 py-1.5 rounded-lg border border-emerald-900/40">
            <span className="text-emerald-300/80 flex items-center gap-1">
              <Clock className="w-3 h-3 text-emerald-400" /> Winning Bid
            </span>
            <span className="font-mono font-bold text-emerald-300">
              {Number(formatUnits(data.highestBid, 18)).toFixed(2)} CTC
            </span>
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-amber-400 !border-2 !border-slate-900"
      />
    </div>
  );
});

AuctionNode.displayName = 'AuctionNode';
