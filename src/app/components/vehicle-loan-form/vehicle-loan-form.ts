import { Component, computed, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { numFromEvent } from '../../shared/num-input';
import { fmtINR } from '../../shared/format';

@Component({
  imports: [],
  selector: 'app-vehicle-loan-form',
  styleUrl: './vehicle-loan-form.css',
  templateUrl: './vehicle-loan-form.html',
})
export class VehicleLoanForm {
  protected readonly calc = inject(CalculatorService);
  protected readonly numFromEvent = numFromEvent;
  protected readonly fmtINR = fmtINR;

  protected readonly downFillPct = computed(() => (this.calc.downPaymentPct() / 60) * 100);

  onRangeInput(e: Event): void {
    this.calc.downPaymentPct.set(numFromEvent(e));
  }

  onDecimalInput(e: Event): void {
    let v = numFromEvent(e);
    if (v < 0) v = 0;
    if (v > 60) v = 60;
    this.calc.downPaymentPct.set(v);
  }
}
