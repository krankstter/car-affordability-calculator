import { Component, computed, inject, signal } from '@angular/core';
import { CalculatorService, YearProjection } from '../../services/calculator.service';
import { TooltipService } from '../../services/tooltip.service';
import { fmtINR } from '../../shared/format';

interface YearCategory {
  key: 'emi' | 'fuel' | 'insurance' | 'maintenance';
  label: string;
  colorVar: string;
}

interface BarSegment {
  key: YearCategory['key'];
  colorVar: string;
  label: string;
  value: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface YearBar {
  year: number;
  x: number;
  labelX: number;
  segments: BarSegment[];
}

interface ChartGeometry {
  width: number;
  height: number;
  chartHeight: number;
  bars: YearBar[];
  gridLines: number[];
}

const YEAR_CATEGORIES: YearCategory[] = [
  { key: 'emi', label: 'EMI', colorVar: 'var(--series-emi)' },
  { key: 'fuel', label: 'Fuel / energy', colorVar: 'var(--series-fuel)' },
  { key: 'insurance', label: 'Insurance', colorVar: 'var(--series-insurance)' },
  { key: 'maintenance', label: 'Maintenance', colorVar: 'var(--series-maintenance)' },
];

const BAR_W = 12;
const GAP = 8;
const COL_W = BAR_W + GAP;
const CHART_H = 100;

@Component({
  imports: [],
  selector: 'app-yearly-chart',
  styleUrl: './yearly-chart.scss',
  templateUrl: './yearly-chart.html',
})
export class YearlyChart {
  protected readonly calc = inject(CalculatorService);
  private readonly tooltip = inject(TooltipService);
  protected readonly fmtINR = fmtINR;
  protected readonly categories = YEAR_CATEGORIES;

  protected readonly showTable = signal(false);

  private readonly maxTotal = computed(() => Math.max(1, ...this.calc.yearlyProjection().map((y) => y.total)));

  protected readonly geometry = computed<ChartGeometry>(() => {
    const years = this.calc.yearlyProjection();
    const max = this.maxTotal();
    const bars: YearBar[] = years.map((year, i) => {
      const x = i * COL_W + GAP / 2;
      let cumulative = 0;
      const segments: BarSegment[] = YEAR_CATEGORIES.map((cat) => {
        const value = year[cat.key];
        const h = max > 0 ? (value / max) * CHART_H : 0;
        const y = CHART_H - cumulative - h;
        cumulative += h;
        return { key: cat.key, colorVar: cat.colorVar, label: cat.label, value, x, y, width: BAR_W, height: Math.max(0, h) };
      });
      return { year: year.year, x, labelX: x + BAR_W / 2, segments };
    });
    return {
      width: Math.max(COL_W, years.length * COL_W),
      height: CHART_H,
      chartHeight: CHART_H,
      bars,
      gridLines: [0.25, 0.5, 0.75].map((f) => CHART_H * (1 - f)),
    };
  });

  toggleTable(): void {
    this.showTable.update((v) => !v);
  }

  segLabel(year: number, seg: BarSegment): string {
    return `Yr ${year} · ${seg.label}: ${fmtINR(seg.value)}`;
  }

  onEnter(e: Event, year: number, seg: BarSegment): void {
    this.tooltip.show(e.currentTarget as HTMLElement, this.segLabel(year, seg));
  }

  onLeave(): void {
    this.tooltip.hide();
  }

  onTap(e: Event, year: number, seg: BarSegment): void {
    e.stopPropagation();
    this.tooltip.showForTap(e.currentTarget as HTMLElement, this.segLabel(year, seg));
  }
}
