import { Component, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { fmtINR } from '../../shared/format';

@Component({
  imports: [],
  selector: 'app-loan-summary',
  styleUrl: './loan-summary.scss',
  templateUrl: './loan-summary.html',
})
export class LoanSummary {
  protected readonly calc = inject(CalculatorService);
  protected readonly fmtINR = fmtINR;
}
