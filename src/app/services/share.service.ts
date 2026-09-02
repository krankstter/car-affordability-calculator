import { Injectable } from '@angular/core';

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'unsupported';

export interface ShareStats {
  affordabilityScore: number;
  verdictTitle: string;
  onRoadPrice: number;
  totalMonthly: number;
  emi?: number;
}

@Injectable({ providedIn: 'root' })
export class ShareService {
  buildSummaryText(name: string, stats: ShareStats): string {
    const fmt = (n: number) => '₹' + Math.round(n).toLocaleString('en-IN');
    const costLine =
      stats.emi !== undefined
        ? `EMI: ${fmt(stats.emi)}/mo · Total monthly: ${fmt(stats.totalMonthly)}`
        : `Total monthly cost: ${fmt(stats.totalMonthly)}/mo`;
    return (
      `${name} — ${stats.affordabilityScore}/100 (${stats.verdictTitle})\n` +
      `On-road price: ${fmt(stats.onRoadPrice)}\n` +
      `${costLine}\n` +
      `via Car Affordability Calculator`
    );
  }

  async share(title: string, text: string): Promise<ShareOutcome> {
    if (typeof navigator === 'undefined') return 'unsupported';
    try {
      if (navigator.share) {
        await navigator.share({ title, text });
        return 'shared';
      }
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return 'cancelled';
      /* fall through to clipboard */
    }
    try {
      await navigator.clipboard.writeText(text);
      return 'copied';
    } catch {
      return 'unsupported';
    }
  }
}
