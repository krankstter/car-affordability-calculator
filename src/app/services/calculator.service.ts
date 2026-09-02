import { Injectable, Signal, WritableSignal, computed, effect, signal } from '@angular/core';

export type FuelType = 'petrol' | 'diesel' | 'cng' | 'electric';
export type EmploymentType = 'salaried' | 'self';
export type StatusLevel = 'good' | 'warning' | 'critical';

export interface FuelDefaults {
  priceLabel: string;
  mileageLabel: string;
  price: number;
  mileage: number;
}

export interface MonthlyCategory {
  key: 'emi' | 'fuel' | 'insurance' | 'maintenance';
  label: string;
  colorVar: string;
  value: number;
}

export interface YearProjection {
  year: number;
  emi: number;
  fuel: number;
  insurance: number;
  maintenance: number;
  total: number;
}

export interface Perspective {
  name: string;
  status: StatusLevel;
  detail: string;
  source: string;
}

export const FUEL_DEFAULTS: Record<FuelType, FuelDefaults> = {
  petrol: { priceLabel: 'Fuel price (₹/litre)', mileageLabel: 'Mileage (km/litre)', price: 100, mileage: 15 },
  diesel: { priceLabel: 'Fuel price (₹/litre)', mileageLabel: 'Mileage (km/litre)', price: 90, mileage: 18 },
  cng: { priceLabel: 'Fuel price (₹/kg)', mileageLabel: 'Mileage (km/kg)', price: 75, mileage: 25 },
  electric: { priceLabel: 'Electricity price (₹/kWh)', mileageLabel: 'Efficiency (km/kWh)', price: 8, mileage: 6 },
};

const DEPRECIATION_SUGGEST: Record<FuelType, number> = { petrol: 12, diesel: 13, cng: 11, electric: 15 };

const DEFAULTS = {
  monthlyIncome: 100000,
  age: 30,
  employmentType: 'salaried' as EmploymentType,
  existingEMIs: 0,
  sipMonthly: 5000,
  onRoadPrice: 1014000,
  downPaymentPct: 20,
  interestRate: 9.5,
  loanTenureYears: 5,
  fuelType: 'petrol' as FuelType,
  monthlyKm: 1000,
  fuelPrice: 100,
  mileage: 15,
  insuranceAnnual: 20250,
  prepaidTPYears: 3,
  maintenanceAnnual: 13500,
  ownershipYears: 5,
  depreciationRatePct: 12,
};

const STORAGE_KEY = 'cac-state';

function computeEMI(principal: number, annualRatePct: number, years: number): number {
  const r = annualRatePct / 1200;
  const n = years * 12;
  if (n <= 0) return 0;
  if (r === 0) return principal / n;
  const f = Math.pow(1 + r, n);
  return (principal * r * f) / (f - 1);
}

@Injectable({ providedIn: 'root' })
export class CalculatorService {
  // ---- Inputs (writable signals) ----
  readonly monthlyIncome = signal(DEFAULTS.monthlyIncome);
  readonly age = signal(DEFAULTS.age);
  readonly employmentType = signal<EmploymentType>(DEFAULTS.employmentType);
  readonly existingEMIs = signal(DEFAULTS.existingEMIs);
  readonly sipMonthly = signal(DEFAULTS.sipMonthly);

  readonly onRoadPrice = signal(DEFAULTS.onRoadPrice);
  readonly downPaymentPct = signal(DEFAULTS.downPaymentPct);
  readonly interestRate = signal(DEFAULTS.interestRate);
  readonly loanTenureYears = signal(DEFAULTS.loanTenureYears);

  readonly fuelType = signal<FuelType>(DEFAULTS.fuelType);
  readonly monthlyKm = signal(DEFAULTS.monthlyKm);
  readonly fuelPrice = signal(DEFAULTS.fuelPrice);
  readonly mileage = signal(DEFAULTS.mileage);
  readonly insuranceAnnual = signal(DEFAULTS.insuranceAnnual);
  readonly prepaidTPYears = signal(DEFAULTS.prepaidTPYears);
  readonly maintenanceAnnual = signal(DEFAULTS.maintenanceAnnual);

  readonly ownershipYears = signal(DEFAULTS.ownershipYears);
  readonly depreciationRatePct = signal(DEFAULTS.depreciationRatePct);

  private readonly restored = signal(false);

  // ---- Derived (computed signals) ----
  readonly downAmt = computed(() => (this.onRoadPrice() * this.downPaymentPct()) / 100);
  readonly loanAmt = computed(() => Math.max(0, this.onRoadPrice() - this.downAmt()));
  readonly emi = computed(() => computeEMI(this.loanAmt(), this.interestRate(), this.loanTenureYears()));
  readonly totalPayable = computed(() => this.emi() * this.loanTenureYears() * 12);
  readonly totalInterest = computed(() => Math.max(0, this.totalPayable() - this.loanAmt()));

  readonly fuelMonthly = computed(() => (this.mileage() > 0 ? (this.monthlyKm() / this.mileage()) * this.fuelPrice() : 0));
  readonly insuranceMonthly = computed(() => this.insuranceAnnual() / 12);
  readonly maintenanceMonthly = computed(() => this.maintenanceAnnual() / 12);
  readonly runningMonthly = computed(() => this.fuelMonthly() + this.insuranceMonthly() + this.maintenanceMonthly());
  readonly totalMonthly = computed(() => this.emi() + this.runningMonthly());

  readonly emiPct = computed(() => (this.monthlyIncome() > 0 ? (this.emi() / this.monthlyIncome()) * 100 : 0));
  readonly carCostPct = computed(() => (this.monthlyIncome() > 0 ? (this.totalMonthly() / this.monthlyIncome()) * 100 : 0));
  readonly debtPct = computed(() =>
    this.monthlyIncome() > 0 ? ((this.emi() + this.existingEMIs() + this.sipMonthly()) / this.monthlyIncome()) * 100 : 0
  );

  readonly resaleValue = computed(() => this.onRoadPrice() * Math.pow(1 - this.depreciationRatePct() / 100, this.ownershipYears()));
  readonly valueLost = computed(() => this.onRoadPrice() - this.resaleValue());

  readonly downPaymentPass = computed(() => this.downPaymentPct() >= 20);
  readonly tenurePass = computed(() => this.loanTenureYears() <= 4);
  readonly totalCostPass = computed(() => this.carCostPct() <= 10);

  readonly verdictLevel = computed<StatusLevel | 'no-income'>(() => {
    if (this.monthlyIncome() <= 0) return 'no-income';
    const emiPct = this.emiPct();
    const carCostPct = this.carCostPct();
    const debtPct = this.debtPct();
    if (emiPct <= 20 && carCostPct <= 15 && debtPct <= 40) return 'good';
    if (emiPct <= 28 && carCostPct <= 20 && debtPct <= 50) return 'warning';
    return 'critical';
  });

  readonly verdictTitle = computed(() => {
    switch (this.verdictLevel()) {
      case 'no-income': return 'Enter your income';
      case 'good': return 'Comfortably affordable';
      case 'warning': return 'A bit of a stretch';
      default: return 'Not recommended';
    }
  });

  readonly verdictSub = computed(() => {
    switch (this.verdictLevel()) {
      case 'no-income': return 'Add your monthly take-home income to see a personalised verdict.';
      case 'good': return 'Your EMI and running costs fit well within a healthy share of your income.';
      case 'warning': return "It's workable, but you're above the comfortable 20% EMI / 15% total-cost guideline.";
      default: return 'EMI and running costs take up too large a share of income. Consider a lower price, bigger down payment, or longer tenure.';
    }
  });

  // Kept in the same band as verdictLevel (good=80-100, warning=50-79, critical=0-49) so the
  // headline score and the verdict text can never tell contradictory stories.
  readonly affordabilityScore = computed<number>(() => {
    const level = this.verdictLevel();
    if (level === 'no-income') return 0;

    const bounds =
      level === 'good' ? { emi: 20, car: 15, debt: 40 } : level === 'warning' ? { emi: 28, car: 20, debt: 50 } : { emi: 40, car: 30, debt: 65 };
    const strain =
      clamp01(this.emiPct() / bounds.emi) * 0.45 +
      clamp01(this.carCostPct() / bounds.car) * 0.4 +
      clamp01(this.debtPct() / bounds.debt) * 0.15;

    const [lo, hi] = level === 'good' ? [80, 100] : level === 'warning' ? [50, 79] : [0, 49];
    return Math.round(hi - clamp01(strain) * (hi - lo));
  });

  readonly meterEmiStatus = computed<StatusLevel>(() => statusFor(this.emiPct(), 20, 28));
  readonly meterTotalStatus = computed<StatusLevel>(() => statusFor(this.carCostPct(), 15, 20));

  readonly monthlyBreakdown = computed<MonthlyCategory[]>(() => [
    { key: 'emi', label: 'EMI', colorVar: 'var(--series-emi)', value: Math.max(0, this.emi()) },
    { key: 'fuel', label: 'Fuel / energy', colorVar: 'var(--series-fuel)', value: Math.max(0, this.fuelMonthly()) },
    { key: 'insurance', label: 'Insurance', colorVar: 'var(--series-insurance)', value: Math.max(0, this.insuranceMonthly()) },
    { key: 'maintenance', label: 'Maintenance', colorVar: 'var(--series-maintenance)', value: Math.max(0, this.maintenanceMonthly()) },
  ]);

  readonly yearlyProjection = computed<YearProjection[]>(() => {
    const years: YearProjection[] = [];
    const tenure = this.loanTenureYears();
    const emi = this.emi();
    const fuelAnnual = this.fuelMonthly() * 12;
    const insuranceAnnual = this.insuranceAnnual();
    const prepaidTPYears = this.prepaidTPYears();
    const depRate = this.depreciationRatePct();
    const maintenanceAnnualBase = this.maintenanceAnnual();
    const ownershipYears = Math.max(1, this.ownershipYears());

    for (let y = 1; y <= ownershipYears; y++) {
      const emiAnnual = y <= tenure ? emi * 12 : 0;
      const insAnnual = y === 1 ? insuranceAnnual : y <= prepaidTPYears ? 0 : insuranceAnnual * Math.pow(1 - depRate / 100, y - 1);
      const maintAnnual = maintenanceAnnualBase * Math.pow(1.08, y - 1);
      years.push({
        year: y,
        emi: emiAnnual,
        fuel: fuelAnnual,
        insurance: insAnnual,
        maintenance: maintAnnual,
        total: emiAnnual + fuelAnnual + insAnnual + maintAnnual,
      });
    }
    return years;
  });

  readonly perspectives = computed<Perspective[]>(() => {
    const annualIncome = this.monthlyIncome() * 12;
    const onRoad = this.onRoadPrice();

    const priceToIncomePct = annualIncome > 0 ? (onRoad / annualIncome) * 100 : 0;
    const teamBhpStatus: StatusLevel = priceToIncomePct <= 50 ? 'good' : priceToIncomePct <= 100 ? 'warning' : 'critical';
    const teamBhpDetail =
      `On-road price is ${priceToIncomePct.toFixed(0)}% of your annual household income` +
      (teamBhpStatus === 'good'
        ? ', within the comfortable zone.'
        : teamBhpStatus === 'warning'
        ? ', above the comfortable 50%, but within the commonly-cited outer ceiling of ~100%.'
        : ', beyond the outer ceiling most enthusiasts suggest.');

    const debtPct = this.debtPct();
    const dtiStatus: StatusLevel = debtPct <= 40 ? 'good' : debtPct <= 50 ? 'warning' : 'critical';
    const dtiDetail =
      `This car's EMI + your existing EMIs/SIPs use ${debtPct.toFixed(0)}% of household income` +
      (dtiStatus === 'good'
        ? ', comfortably inside the 40% band lenders like.'
        : dtiStatus === 'warning'
        ? ', inside the 40–50% band most banks will still approve, but with less cushion.'
        : ', above the ~50% ceiling most lenders cap total debt at.');

    const maturityAge = this.age() + this.loanTenureYears();
    const ageCap = this.employmentType() === 'self' ? 68 : 65;
    const ageStatus: StatusLevel = maturityAge <= ageCap ? 'good' : maturityAge <= ageCap + 3 ? 'warning' : 'critical';
    const ageDetail =
      `Loan would mature at age ${maturityAge}` +
      (ageStatus === 'good'
        ? `, comfortably within the usual ~${ageCap} cutoff.`
        : ageStatus === 'warning'
        ? `, close to or slightly past the usual ~${ageCap} cutoff, so some lenders may ask for a shorter tenure.`
        : `, well past the usual ~${ageCap} cutoff most lenders apply, so expect a shorter approved tenure.`);

    return [
      {
        name: 'TeamBHP community rule',
        status: teamBhpStatus,
        detail: teamBhpDetail,
        source: 'Price ≤ 50% of annual income comfortable, ≤ ~100% as an outer ceiling, per Team-BHP’s long-running "What Car @ What Salary" thread',
      },
      {
        name: 'Bank debt-to-income norm',
        status: dtiStatus,
        detail: dtiDetail,
        source: 'Typical lender underwriting: total EMIs ≤ 40–50% of net income',
      },
      {
        name: 'Age vs. loan tenure',
        status: ageStatus,
        detail: ageDetail,
        source: 'Most Indian lenders require the loan to mature by ~65 (salaried) or ~68 (self-employed)',
      },
    ];
  });

  constructor() {
    this.restore();
    this.restored.set(true);

    effect(() => {
      // Touch every input signal so this effect re-runs on any change, then persist.
      const state = {
        monthlyIncome: this.monthlyIncome(),
        age: this.age(),
        employmentType: this.employmentType(),
        existingEMIs: this.existingEMIs(),
        sipMonthly: this.sipMonthly(),
        onRoadPrice: this.onRoadPrice(),
        downPaymentPct: this.downPaymentPct(),
        interestRate: this.interestRate(),
        loanTenureYears: this.loanTenureYears(),
        fuelType: this.fuelType(),
        monthlyKm: this.monthlyKm(),
        fuelPrice: this.fuelPrice(),
        mileage: this.mileage(),
        insuranceAnnual: this.insuranceAnnual(),
        prepaidTPYears: this.prepaidTPYears(),
        maintenanceAnnual: this.maintenanceAnnual(),
        ownershipYears: this.ownershipYears(),
        depreciationRatePct: this.depreciationRatePct(),
      };
      if (!this.restored()) return;
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* localStorage unavailable (private mode, etc.) — non-fatal */
      }
    });
  }

  suggestedDepreciation(): number {
    return DEPRECIATION_SUGGEST[this.fuelType()];
  }

  onFuelTypeChange(type: FuelType): void {
    this.fuelType.set(type);
    const d = FUEL_DEFAULTS[type];
    this.fuelPrice.set(d.price);
    this.mileage.set(d.mileage);
  }

  suggestInsurance(): void {
    this.insuranceAnnual.set(Math.round(this.onRoadPrice() * 0.0225));
  }

  suggestMaintenance(): void {
    this.maintenanceAnnual.set(Math.round(this.onRoadPrice() * 0.015));
  }

  suggestDepreciationRate(): void {
    this.depreciationRatePct.set(this.suggestedDepreciation());
  }

  resetToDefaults(): void {
    this.monthlyIncome.set(DEFAULTS.monthlyIncome);
    this.age.set(DEFAULTS.age);
    this.employmentType.set(DEFAULTS.employmentType);
    this.existingEMIs.set(DEFAULTS.existingEMIs);
    this.sipMonthly.set(DEFAULTS.sipMonthly);
    this.onRoadPrice.set(DEFAULTS.onRoadPrice);
    this.downPaymentPct.set(DEFAULTS.downPaymentPct);
    this.interestRate.set(DEFAULTS.interestRate);
    this.loanTenureYears.set(DEFAULTS.loanTenureYears);
    this.fuelType.set(DEFAULTS.fuelType);
    this.monthlyKm.set(DEFAULTS.monthlyKm);
    this.fuelPrice.set(DEFAULTS.fuelPrice);
    this.mileage.set(DEFAULTS.mileage);
    this.insuranceAnnual.set(DEFAULTS.insuranceAnnual);
    this.prepaidTPYears.set(DEFAULTS.prepaidTPYears);
    this.maintenanceAnnual.set(DEFAULTS.maintenanceAnnual);
    this.ownershipYears.set(DEFAULTS.ownershipYears);
    this.depreciationRatePct.set(DEFAULTS.depreciationRatePct);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* non-fatal */
    }
  }

  private restore(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const state = JSON.parse(raw) as Partial<Record<keyof typeof DEFAULTS, unknown>>;
      const setNum = (sig: WritableSignal<number>, key: string) => {
        const v = (state as Record<string, unknown>)[key];
        if (typeof v === 'number' && isFinite(v)) sig.set(v);
      };
      setNum(this.monthlyIncome, 'monthlyIncome');
      setNum(this.age, 'age');
      setNum(this.existingEMIs, 'existingEMIs');
      setNum(this.sipMonthly, 'sipMonthly');
      setNum(this.onRoadPrice, 'onRoadPrice');
      setNum(this.downPaymentPct, 'downPaymentPct');
      setNum(this.interestRate, 'interestRate');
      setNum(this.loanTenureYears, 'loanTenureYears');
      setNum(this.monthlyKm, 'monthlyKm');
      setNum(this.fuelPrice, 'fuelPrice');
      setNum(this.mileage, 'mileage');
      setNum(this.insuranceAnnual, 'insuranceAnnual');
      setNum(this.prepaidTPYears, 'prepaidTPYears');
      setNum(this.maintenanceAnnual, 'maintenanceAnnual');
      setNum(this.ownershipYears, 'ownershipYears');
      setNum(this.depreciationRatePct, 'depreciationRatePct');
      const employmentType = (state as Record<string, unknown>)['employmentType'];
      if (employmentType === 'salaried' || employmentType === 'self') this.employmentType.set(employmentType);
      const fuelType = (state as Record<string, unknown>)['fuelType'];
      if (fuelType === 'petrol' || fuelType === 'diesel' || fuelType === 'cng' || fuelType === 'electric') this.fuelType.set(fuelType);
    } catch {
      /* corrupt/unavailable storage — fall back to defaults, non-fatal */
    }
  }
}

function statusFor(pct: number, goodMax: number, warnMax: number): StatusLevel {
  if (pct <= goodMax) return 'good';
  if (pct <= warnMax) return 'warning';
  return 'critical';
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}
