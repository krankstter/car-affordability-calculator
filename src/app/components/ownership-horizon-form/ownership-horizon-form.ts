import { Component, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { numFromEvent } from '../../shared/num-input';

@Component({
  imports: [],
  selector: 'app-ownership-horizon-form',
  styleUrl: './ownership-horizon-form.scss',
  templateUrl: './ownership-horizon-form.html',
})
export class OwnershipHorizonForm {
  protected readonly calc = inject(CalculatorService);
  protected readonly numFromEvent = numFromEvent;
}
