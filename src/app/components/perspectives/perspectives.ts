import { Component, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';

@Component({
  imports: [],
  selector: 'app-perspectives',
  styleUrl: './perspectives.css',
  templateUrl: './perspectives.html',
})
export class Perspectives {
  protected readonly calc = inject(CalculatorService);
}
