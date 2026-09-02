import { Injectable, afterNextRender, inject, signal } from '@angular/core';
import { GarageService } from './garage.service';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

@Injectable({ providedIn: 'root' })
export class ReminderService {
  private readonly garage = inject(GarageService);

  readonly permission = signal<NotificationPermission>(this.readPermission());

  constructor() {
    afterNextRender(() => {
      this.checkDue();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this.checkDue();
        });
      }
    });
  }

  // Only ever call this from an explicit user gesture (button click) — never on load.
  async requestPermission(): Promise<void> {
    if (typeof Notification === 'undefined') return;
    try {
      const result = await Notification.requestPermission();
      this.permission.set(result);
    } catch {
      /* non-fatal */
    }
  }

  private readPermission(): NotificationPermission {
    try {
      return typeof Notification !== 'undefined' ? Notification.permission : 'denied';
    } catch {
      return 'denied';
    }
  }

  private async checkDue(): Promise<void> {
    if (this.permission() !== 'granted') return;
    const today = todayKey();
    for (const g of this.garage.goals()) {
      const r = g.reminder;
      if (!r || r.fired || r.forDate > today) continue;
      await this.fire(g.name, g.history[g.history.length - 1]?.affordabilityScore);
      this.garage.markReminderFired(g.id);
    }
  }

  private async fire(name: string, lastScore: number | undefined): Promise<void> {
    const title = `Time to check "${name}"`;
    const body = `Last known affordability score: ${lastScore ?? '—'}/100.`;
    try {
      if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification(title, { body });
        return;
      }
    } catch {
      /* fall through to Notification fallback */
    }
    try {
      new Notification(title, { body });
    } catch {
      /* best-effort only, non-fatal */
    }
  }
}
