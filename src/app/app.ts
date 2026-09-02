import { Component } from '@angular/core';
import { Topbar } from './components/topbar/topbar';
import { IncomeForm } from './components/income-form/income-form';
import { VehicleLoanForm } from './components/vehicle-loan-form/vehicle-loan-form';
import { RunningCostsForm } from './components/running-costs-form/running-costs-form';
import { OwnershipHorizonForm } from './components/ownership-horizon-form/ownership-horizon-form';
import { Verdict } from './components/verdict/verdict';
import { Perspectives } from './components/perspectives/perspectives';
import { MonthlyStats } from './components/monthly-stats/monthly-stats';
import { MonthlyChart } from './components/monthly-chart/monthly-chart';
import { YearlyChart } from './components/yearly-chart/yearly-chart';
import { LoanSummary } from './components/loan-summary/loan-summary';
import { Tooltip } from './components/tooltip/tooltip';
import { StepRail } from './components/step-rail/step-rail';
import { MobileSummaryBar } from './components/mobile-summary-bar/mobile-summary-bar';
import { AiAssistant } from './components/ai-assistant/ai-assistant';
import { GarageDrawer } from './components/garage-drawer/garage-drawer';
import { InstallBanner } from './components/install-banner/install-banner';

@Component({
  imports: [
    Topbar,
    StepRail,
    IncomeForm,
    VehicleLoanForm,
    RunningCostsForm,
    OwnershipHorizonForm,
    Verdict,
    AiAssistant,
    Perspectives,
    MonthlyStats,
    MonthlyChart,
    YearlyChart,
    LoanSummary,
    Tooltip,
    MobileSummaryBar,
    GarageDrawer,
    InstallBanner,
  ],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
