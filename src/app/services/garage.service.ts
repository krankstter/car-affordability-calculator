import { Injectable, WritableSignal, computed, effect, inject, signal, untracked } from '@angular/core';
import { CalculatorService, EmploymentType, FuelType, StatusLevel } from './calculator.service';

export interface GoalSnapshot {
  monthlyIncome: number;
  age: number;
  employmentType: EmploymentType;
  existingEMIs: number;
  sipMonthly: number;
  onRoadPrice: number;
  downPaymentPct: number;
  interestRate: number;
  loanTenureYears: number;
  fuelType: FuelType;
  monthlyKm: number;
  fuelPrice: number;
  mileage: number;
  insuranceAnnual: number;
  prepaidTPYears: number;
  maintenanceAnnual: number;
  ownershipYears: number;
  depreciationRatePct: number;
}

export interface HistoryPoint {
  date: string;
  affordabilityScore: number;
  verdictLevel: StatusLevel | 'no-income';
  totalMonthly: number;
  onRoadPrice: number;
}

export interface GoalReminder {
  forDate: string;
  days: number;
  createdAt: string;
  fired: boolean;
}

export interface Goal {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  snapshot: GoalSnapshot;
  history: HistoryPoint[];
  reminder: GoalReminder | null;
}

const STORAGE_KEY = 'cac-goals';

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDaysKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function makeId(): string {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* fall through */
  }
  return 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

@Injectable({ providedIn: 'root' })
export class GarageService {
  private readonly calc = inject(CalculatorService);

  readonly goals = signal<Goal[]>([]);
  readonly activeGoalId = signal<string | null>(null);
  readonly open = signal(false);

  readonly activeGoal = computed(() => this.goals().find((g) => g.id === this.activeGoalId()) ?? null);

  private readonly restored = signal(false);

  constructor() {
    this.restore();
    this.restored.set(true);

    // Auto-history upsert: tracks the calculator's derived signals for the active goal,
    // but writes to `goals` inside untracked() so this effect doesn't re-trigger itself.
    effect(() => {
      const goalId = this.activeGoalId();
      const score = this.calc.affordabilityScore();
      const level = this.calc.verdictLevel();
      const total = this.calc.totalMonthly();
      const price = this.calc.onRoadPrice();
      if (!goalId || !this.restored()) return;

      untracked(() => {
        const today = todayKey();
        this.goals.update((list) =>
          list.map((g) => {
            if (g.id !== goalId) return g;
            const point: HistoryPoint = { date: today, affordabilityScore: score, verdictLevel: level, totalMonthly: total, onRoadPrice: price };
            const last = g.history[g.history.length - 1];
            const history = last?.date === today ? [...g.history.slice(0, -1), point] : [...g.history, point];
            return { ...g, history, updatedAt: new Date().toISOString() };
          })
        );
      });
    });

    effect(() => {
      const state = { goals: this.goals(), activeGoalId: this.activeGoalId() };
      if (!this.restored()) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* localStorage unavailable — non-fatal */
      }
    });
  }

  saveAsNewGoal(name: string): Goal {
    const trimmed = name.trim() || 'Untitled goal';
    const now = new Date().toISOString();
    const snapshot = this.snapshotCurrent();
    const goal: Goal = {
      id: makeId(),
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      snapshot,
      history: [
        {
          date: todayKey(),
          affordabilityScore: this.calc.affordabilityScore(),
          verdictLevel: this.calc.verdictLevel(),
          totalMonthly: this.calc.totalMonthly(),
          onRoadPrice: this.calc.onRoadPrice(),
        },
      ],
      reminder: null,
    };
    this.goals.update((list) => [...list, goal]);
    this.activeGoalId.set(goal.id);
    return goal;
  }

  loadGoal(id: string): void {
    const goal = this.goals().find((g) => g.id === id);
    if (!goal) return;
    const s = goal.snapshot;
    this.calc.monthlyIncome.set(s.monthlyIncome);
    this.calc.age.set(s.age);
    this.calc.employmentType.set(s.employmentType);
    this.calc.existingEMIs.set(s.existingEMIs);
    this.calc.sipMonthly.set(s.sipMonthly);
    this.calc.onRoadPrice.set(s.onRoadPrice);
    this.calc.downPaymentPct.set(s.downPaymentPct);
    this.calc.interestRate.set(s.interestRate);
    this.calc.loanTenureYears.set(s.loanTenureYears);
    this.calc.fuelType.set(s.fuelType);
    this.calc.monthlyKm.set(s.monthlyKm);
    this.calc.fuelPrice.set(s.fuelPrice);
    this.calc.mileage.set(s.mileage);
    this.calc.insuranceAnnual.set(s.insuranceAnnual);
    this.calc.prepaidTPYears.set(s.prepaidTPYears);
    this.calc.maintenanceAnnual.set(s.maintenanceAnnual);
    this.calc.ownershipYears.set(s.ownershipYears);
    this.calc.depreciationRatePct.set(s.depreciationRatePct);
    this.activeGoalId.set(goal.id);
  }

  updateActiveSnapshot(id: string): void {
    const snapshot = this.snapshotCurrent();
    this.goals.update((list) => list.map((g) => (g.id === id ? { ...g, snapshot, updatedAt: new Date().toISOString() } : g)));
  }

  renameGoal(id: string, name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    this.goals.update((list) => list.map((g) => (g.id === id ? { ...g, name: trimmed, updatedAt: new Date().toISOString() } : g)));
  }

  deleteGoal(id: string): void {
    this.goals.update((list) => list.filter((g) => g.id !== id));
    if (this.activeGoalId() === id) this.activeGoalId.set(null);
  }

  unlinkActive(): void {
    this.activeGoalId.set(null);
  }

  setReminder(id: string, days: number): void {
    const reminder: GoalReminder = { forDate: addDaysKey(days), days, createdAt: new Date().toISOString(), fired: false };
    this.goals.update((list) => list.map((g) => (g.id === id ? { ...g, reminder } : g)));
  }

  clearReminder(id: string): void {
    this.goals.update((list) => list.map((g) => (g.id === id ? { ...g, reminder: null } : g)));
  }

  markReminderFired(id: string): void {
    this.goals.update((list) => list.map((g) => (g.id === id && g.reminder ? { ...g, reminder: { ...g.reminder, fired: true } } : g)));
  }

  private snapshotCurrent(): GoalSnapshot {
    return {
      monthlyIncome: this.calc.monthlyIncome(),
      age: this.calc.age(),
      employmentType: this.calc.employmentType(),
      existingEMIs: this.calc.existingEMIs(),
      sipMonthly: this.calc.sipMonthly(),
      onRoadPrice: this.calc.onRoadPrice(),
      downPaymentPct: this.calc.downPaymentPct(),
      interestRate: this.calc.interestRate(),
      loanTenureYears: this.calc.loanTenureYears(),
      fuelType: this.calc.fuelType(),
      monthlyKm: this.calc.monthlyKm(),
      fuelPrice: this.calc.fuelPrice(),
      mileage: this.calc.mileage(),
      insuranceAnnual: this.calc.insuranceAnnual(),
      prepaidTPYears: this.calc.prepaidTPYears(),
      maintenanceAnnual: this.calc.maintenanceAnnual(),
      ownershipYears: this.calc.ownershipYears(),
      depreciationRatePct: this.calc.depreciationRatePct(),
    };
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as { goals?: unknown; activeGoalId?: unknown };
      if (!Array.isArray(state.goals)) return;
      const goals = state.goals.filter(isValidGoal);
      this.goals.set(goals);
      if (typeof state.activeGoalId === 'string' && goals.some((g) => g.id === state.activeGoalId)) {
        this.activeGoalId.set(state.activeGoalId);
      }
    } catch {
      /* corrupt/unavailable storage — fall back to empty, non-fatal */
    }
  }
}

function isValidGoal(v: unknown): v is Goal {
  if (!v || typeof v !== 'object') return false;
  const g = v as Record<string, unknown>;
  return (
    typeof g['id'] === 'string' &&
    typeof g['name'] === 'string' &&
    typeof g['createdAt'] === 'string' &&
    typeof g['updatedAt'] === 'string' &&
    !!g['snapshot'] &&
    typeof g['snapshot'] === 'object' &&
    Array.isArray(g['history'])
  );
}
