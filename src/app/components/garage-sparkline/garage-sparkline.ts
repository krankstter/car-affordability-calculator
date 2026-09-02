import { Component, computed, input } from '@angular/core';
import { HistoryPoint } from '../../services/garage.service';

interface SparkGeometry {
  points: string;
  w: number;
  h: number;
}

const W = 120;
const H = 32;

@Component({
  imports: [],
  selector: 'app-garage-sparkline',
  styleUrl: './garage-sparkline.scss',
  templateUrl: './garage-sparkline.html',
})
export class GarageSparkline {
  readonly history = input.required<HistoryPoint[]>();

  protected readonly geometry = computed<SparkGeometry | null>(() => {
    const pts = this.history();
    if (pts.length < 2) return null;
    const step = W / (pts.length - 1);
    const points = pts
      .map((p, i) => `${(i * step).toFixed(1)},${(H - (Math.max(0, Math.min(100, p.affordabilityScore)) / 100) * H).toFixed(1)}`)
      .join(' ');
    return { points, w: W, h: H };
  });

  protected readonly trendLabel = computed<string | null>(() => {
    const pts = this.history();
    if (pts.length < 2) return null;
    const first = pts[0];
    const last = pts[pts.length - 1];
    const days = Math.max(0, Math.round((new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000));
    const span = days >= 60 ? `${Math.round(days / 30)} months` : days >= 14 ? `${Math.round(days / 7)} weeks` : days === 0 ? 'today' : `${days} days`;
    return `${first.affordabilityScore} → ${last.affordabilityScore} over ${span}`;
  });
}
