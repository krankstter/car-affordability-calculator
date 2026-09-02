import { Component, inject, signal } from '@angular/core';
import { CalculatorService, verdictTitleFor } from '../../services/calculator.service';
import { Goal, GarageService } from '../../services/garage.service';
import { ReminderService } from '../../services/reminder.service';
import { ShareOutcome, ShareService } from '../../services/share.service';
import { GarageSparkline } from '../garage-sparkline/garage-sparkline';

const REMINDER_OPTIONS = [3, 7, 14, 30];

@Component({
  imports: [GarageSparkline],
  selector: 'app-garage-drawer',
  styleUrl: './garage-drawer.css',
  templateUrl: './garage-drawer.html',
})
export class GarageDrawer {
  protected readonly garage = inject(GarageService);
  protected readonly calc = inject(CalculatorService);
  protected readonly reminders = inject(ReminderService);
  private readonly shareService = inject(ShareService);

  protected readonly verdictTitleFor = verdictTitleFor;
  protected readonly reminderOptions = REMINDER_OPTIONS;

  protected readonly newGoalName = signal('');
  protected readonly editingId = signal<string | null>(null);
  protected readonly editingName = signal('');

  protected readonly shareGoalId = signal<string | null>(null);
  protected readonly shareOutcome = signal<ShareOutcome | null>(null);
  private shareTimer: ReturnType<typeof setTimeout> | null = null;

  close(): void {
    this.garage.open.set(false);
  }

  saveCurrent(): void {
    const name = this.newGoalName().trim();
    if (!name) return;
    this.garage.saveAsNewGoal(name);
    this.newGoalName.set('');
  }

  load(id: string): void {
    this.garage.loadGoal(id);
  }

  updateSnapshot(id: string): void {
    this.garage.updateActiveSnapshot(id);
  }

  startRename(goal: Goal): void {
    this.editingId.set(goal.id);
    this.editingName.set(goal.name);
  }

  confirmRename(id: string): void {
    this.garage.renameGoal(id, this.editingName());
    this.editingId.set(null);
  }

  cancelRename(): void {
    this.editingId.set(null);
  }

  remove(id: string): void {
    if (typeof window !== 'undefined' && !window.confirm('Delete this saved goal? This removes its history too.')) return;
    this.garage.deleteGoal(id);
  }

  setReminder(id: string, days: number): void {
    this.garage.setReminder(id, days);
  }

  clearReminder(id: string): void {
    this.garage.clearReminder(id);
  }

  async enableNotifications(): Promise<void> {
    await this.reminders.requestPermission();
  }

  async share(goal: Goal): Promise<void> {
    const last = this.latestOf(goal);
    const text = this.shareService.buildSummaryText(goal.name, {
      affordabilityScore: last?.affordabilityScore ?? 0,
      verdictTitle: verdictTitleFor(last?.verdictLevel ?? 'no-income'),
      onRoadPrice: last?.onRoadPrice ?? goal.snapshot.onRoadPrice,
      totalMonthly: last?.totalMonthly ?? 0,
    });
    const outcome = await this.shareService.share(goal.name, text);
    this.shareGoalId.set(goal.id);
    this.shareOutcome.set(outcome);
    if (this.shareTimer) clearTimeout(this.shareTimer);
    this.shareTimer = setTimeout(() => {
      this.shareOutcome.set(null);
      this.shareGoalId.set(null);
    }, 3000);
  }

  shareMessage(): string {
    switch (this.shareOutcome()) {
      case 'shared': return 'Shared.';
      case 'copied': return 'Copied a summary to your clipboard.';
      case 'unsupported': return "Couldn't share on this browser.";
      default: return '';
    }
  }

  latestOf(goal: Goal) {
    return goal.history[goal.history.length - 1] ?? null;
  }
}
