import { Component, inject } from '@angular/core';
import { CalculatorService, FuelType } from '../../services/calculator.service';
import { numFromEvent } from '../../shared/num-input';

@Component({
  imports: [],
  selector: 'app-running-costs-form',
  styleUrl: './running-costs-form.scss',
  templateUrl: './running-costs-form.html',
})
export class RunningCostsForm {
  protected readonly calc = inject(CalculatorService);
  protected readonly numFromEvent = numFromEvent;

  onFuelTypeChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value as FuelType;
    this.calc.onFuelTypeChange(v);
  }
}
