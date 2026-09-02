import { Component, OnDestroy, afterNextRender, signal } from '@angular/core';

interface Step {
  id: string;
  label: string;
}

const STEPS: Step[] = [
  { id: 'step-income', label: 'Income' },
  { id: 'step-loan', label: 'Loan' },
  { id: 'step-costs', label: 'Costs' },
  { id: 'step-ownership', label: 'Ownership' },
];

@Component({
  imports: [],
  selector: 'app-step-rail',
  styleUrl: './step-rail.css',
  templateUrl: './step-rail.html',
})
export class StepRail implements OnDestroy {
  protected readonly steps = STEPS;
  protected readonly activeIndex = signal(0);
  private observer?: IntersectionObserver;

  constructor() {
    afterNextRender(() => this.setupObserver());
  }

  private setupObserver(): void {
    const els = STEPS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const visibleRatios = new Map<string, number>();
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visibleRatios.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of visibleRatios) {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            bestId = id;
          }
        }
        if (bestId) {
          const idx = STEPS.findIndex((s) => s.id === bestId);
          if (idx >= 0) this.activeIndex.set(idx);
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1], rootMargin: '-96px 0px -45% 0px' }
    );
    els.forEach((el) => this.observer!.observe(el));
  }

  goTo(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
