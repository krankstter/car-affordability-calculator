import { Component, computed, inject, signal } from '@angular/core';
import { InstallPromptService } from '../../services/install-prompt.service';

@Component({
  imports: [],
  selector: 'app-install-banner',
  styleUrl: './install-banner.css',
  templateUrl: './install-banner.html',
})
export class InstallBanner {
  protected readonly install = inject(InstallPromptService);
  private readonly dismissedThisSession = signal(false);

  protected readonly isIos = computed(() => this.install.deferredPrompt() === null && this.install.isIosSafari());

  protected readonly visible = computed(
    () =>
      !this.install.installed() &&
      !this.dismissedThisSession() &&
      !this.install.recentlyDismissed() &&
      this.install.engagementMet() &&
      (this.install.deferredPrompt() !== null || this.isIos())
  );

  onInstallClick(): void {
    this.install.promptInstall();
  }

  onDismiss(): void {
    this.dismissedThisSession.set(true);
    this.install.dismiss();
  }
}
