import { Component, computed, inject, signal } from '@angular/core';
import { CalculatorService, MonthlyCategory } from '../../services/calculator.service';
import { TooltipService } from '../../services/tooltip.service';
import { fmtINR } from '../../shared/format';

interface DonutSegment extends MonthlyCategory {
  dashArray: string;
  dashOffset: number;
}

const RADIUS = 45;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

@Component({
  imports: [],
  selector: 'app-monthly-chart',
  styleUrl: './monthly-chart.css',
  templateUrl: './monthly-chart.html',
})
export class MonthlyChart {
  protected readonly calc = inject(CalculatorService);
  private readonly tooltip = inject(TooltipService);
  protected readonly fmtINR = fmtINR;

  protected readonly showTable = signal(false);

  protected readonly segments = computed<DonutSegment[]>(() => {
    const total = this.calc.totalMonthly();
    let cumulative = 0;
    return this.calc.monthlyBreakdown().map((cat) => {
      const frac = total > 0 ? cat.value / total : 0;
      const len = frac * CIRCUMFERENCE;
      const seg: DonutSegment = {
        ...cat,
        dashArray: `${len.toFixed(2)} ${(CIRCUMFERENCE - len).toFixed(2)}`,
        dashOffset: -cumulative,
      };
      cumulative += len;
      return seg;
    });
  });

  toggleTable(): void {
    this.showTable.update((v) => !v);
  }

  segLabel(cat: MonthlyCategory, total: number): string {
    const pct = total > 0 ? ((cat.value / total) * 100).toFixed(0) : '0';
    return `${cat.label}: ${fmtINR(cat.value)}/mo (${pct}%)`;
  }

  onEnter(e: Event, cat: MonthlyCategory, total: number): void {
    this.tooltip.show(e.currentTarget as HTMLElement, this.segLabel(cat, total));
  }

  onLeave(): void {
    this.tooltip.hide();
  }

  onTap(e: Event, cat: MonthlyCategory, total: number): void {
    e.stopPropagation();
    this.tooltip.showForTap(e.currentTarget as HTMLElement, this.segLabel(cat, total));
  }
}
