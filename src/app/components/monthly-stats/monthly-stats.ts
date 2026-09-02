import { Component, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { fmtINR, fmtPct } from '../../shared/format';
import { CountUpDirective } from '../../shared/count-up.directive';

@Component({
  imports: [CountUpDirective],
  selector: 'app-monthly-stats',
  styleUrl: './monthly-stats.scss',
  templateUrl: './monthly-stats.html',
})
export class MonthlyStats {
  protected readonly calc = inject(CalculatorService);
  protected readonly fmtINR = fmtINR;
  protected readonly fmtPct = fmtPct;
}
