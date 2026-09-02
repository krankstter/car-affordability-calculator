import { Injectable, signal } from '@angular/core';

export interface TooltipState {
  visible: boolean;
  text: string;
  x: number;
  y: number;
}

@Injectable({ providedIn: 'root' })
export class TooltipService {
  readonly state = signal<TooltipState>({ visible: false, text: '', x: 0, y: 0 });

  private tapTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('click', () => this.hide());
    }
  }

  show(el: HTMLElement, text: string): void {
    const r = el.getBoundingClientRect();
    this.state.set({ visible: true, text, x: r.left + r.width / 2, y: r.top });
  }

  hide(): void {
    this.state.update((s) => ({ ...s, visible: false }));
  }

  showForTap(el: HTMLElement, text: string): void {
    this.show(el, text);
    if (this.tapTimer) clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => this.hide(), 2500);
  }
}
