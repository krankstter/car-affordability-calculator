import { Component, computed, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';

const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

@Component({
  imports: [],
  selector: 'app-verdict',
  styleUrl: './verdict.css',
  templateUrl: './verdict.html',
})
export class Verdict {
  protected readonly calc = inject(CalculatorService);
  protected readonly circumference = RING_CIRCUMFERENCE;
  protected readonly ringOffset = computed(
    () => RING_CIRCUMFERENCE * (1 - this.calc.affordabilityScore() / 100)
  );
}
