import { Component, computed, inject, signal } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { ShareOutcome, ShareService } from '../../services/share.service';

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

@Component({
  imports: [],
  selector: 'app-verdict',
  styleUrl: './verdict.css',
  templateUrl: './verdict.html',
})
export class Verdict {
  protected readonly calc = inject(CalculatorService);
  private readonly shareService = inject(ShareService);
  protected readonly circumference = RING_CIRCUMFERENCE;
  protected readonly ringOffset = computed(
    () => RING_CIRCUMFERENCE * (1 - this.calc.affordabilityScore() / 100)
  );

  protected readonly shareOutcome = signal<ShareOutcome | null>(null);
  private shareOutcomeTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly shareMessage = computed(() => {
    switch (this.shareOutcome()) {
      case 'shared': return 'Shared.';
      case 'copied': return 'Copied a summary to your clipboard.';
      case 'cancelled': return null;
      case 'unsupported': return "Couldn't share on this browser.";
      default: return null;
    }
  });

  async shareResult(): Promise<void> {
    const text = this.shareService.buildSummaryText('My car affordability check', {
      affordabilityScore: this.calc.affordabilityScore(),
      verdictTitle: this.calc.verdictTitle(),
      onRoadPrice: this.calc.onRoadPrice(),
      emi: this.calc.emi(),
      totalMonthly: this.calc.totalMonthly(),
    });
    const outcome = await this.shareService.share('Car affordability result', text);
    this.shareOutcome.set(outcome);
    if (this.shareOutcomeTimer) clearTimeout(this.shareOutcomeTimer);
    this.shareOutcomeTimer = setTimeout(() => this.shareOutcome.set(null), 3000);
  }
}
