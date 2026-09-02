import { Component, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { fmtINR } from '../../shared/format';

@Component({
  imports: [],
  selector: 'app-mobile-summary-bar',
  styleUrl: './mobile-summary-bar.css',
  templateUrl: './mobile-summary-bar.html',
})
export class MobileSummaryBar {
  protected readonly calc = inject(CalculatorService);
  protected readonly fmtINR = fmtINR;

  goToResults(): void {
    document.getElementById('results-top')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
