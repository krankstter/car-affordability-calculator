import { Directive, ElementRef, OnDestroy, effect, inject, input } from '@angular/core';

/**
 * Animates the host element's text content from its previous numeric value to a new one
 * whenever [countUp] changes, instead of the number snapping instantly. Falls back to an
 * instant set with no animation when requestAnimationFrame isn't available (SSR prerender).
 */
@Directive({
  selector: '[countUp]',
})
export class CountUpDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);

  readonly countUp = input.required<number>();
  readonly countUpFormat = input<(n: number) => string>((n) => Math.round(n).toString());

  private current: number | null = null;
  private rafId: number | null = null;

  constructor() {
    effect(() => {
      const target = this.countUp();
      const format = this.countUpFormat();

      if (typeof requestAnimationFrame === 'undefined') {
        this.el.nativeElement.textContent = format(target);
        return;
      }

      const start = this.current ?? target;
      // First run (no prior value): render immediately, nothing to animate from.
      if (this.current === null) {
        this.current = target;
        this.el.nativeElement.textContent = format(target);
        return;
      }

      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      const startTime = performance.now();
      const duration = 550;
      const step = (now: number) => {
        const t = Math.min(1, (now - startTime) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        const value = start + (target - start) * eased;
        this.el.nativeElement.textContent = format(value);
        if (t < 1) {
          this.rafId = requestAnimationFrame(step);
        } else {
          this.current = target;
          this.el.nativeElement.textContent = format(target);
          this.rafId = null;
        }
      };
      this.rafId = requestAnimationFrame(step);
    });
  }

  ngOnDestroy(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
  }
}
