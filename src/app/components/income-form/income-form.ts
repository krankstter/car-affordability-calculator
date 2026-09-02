import { Component, inject } from '@angular/core';
import { CalculatorService, EmploymentType } from '../../services/calculator.service';
import { numFromEvent } from '../../shared/num-input';

@Component({
  imports: [],
  selector: 'app-income-form',
  styleUrl: './income-form.scss',
  templateUrl: './income-form.html',
})
export class IncomeForm {
  protected readonly calc = inject(CalculatorService);
  protected readonly numFromEvent = numFromEvent;

  onEmploymentTypeChange(e: Event): void {
    const v = (e.target as HTMLSelectElement).value as EmploymentType;
    this.calc.employmentType.set(v);
  }
}
