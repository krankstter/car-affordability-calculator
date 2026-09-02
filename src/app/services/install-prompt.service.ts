import { Injectable, computed, inject, signal } from '@angular/core';
import { CalculatorService } from './calculator.service';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'cac-install-dismissed-at';
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class InstallPromptService {
  private readonly calc = inject(CalculatorService);

  readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  readonly installed = signal(false);
  readonly engagementMet = computed(() => this.calc.verdictLevel() === 'good');

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        this.deferredPrompt.set(e as BeforeInstallPromptEvent);
      });
      window.addEventListener('appinstalled', () => {
        this.installed.set(true);
        this.deferredPrompt.set(null);
      });
      try {
        if (window.matchMedia?.('(display-mode: standalone)').matches) this.installed.set(true);
      } catch {
        /* non-fatal */
      }
    }
  }

  async promptInstall(): Promise<void> {
    const evt = this.deferredPrompt();
    if (!evt) return;
    try {
      await evt.prompt();
      await evt.userChoice;
    } finally {
      this.deferredPrompt.set(null);
    }
  }

  dismiss(): void {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* non-fatal */
    }
  }

  recentlyDismissed(): boolean {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      return !!raw && Date.now() - Number(raw) < DISMISS_COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  isIosSafari(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isStandaloneIos = (navigator as unknown as { standalone?: boolean }).standalone === true;
    return isIos && !isStandaloneIos;
  }
}
