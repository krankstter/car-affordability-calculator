import { Component, inject } from '@angular/core';
import { CalculatorService } from '../../services/calculator.service';
import { ThemeService } from '../../services/theme.service';
import { GarageService } from '../../services/garage.service';

@Component({
  imports: [],
  selector: 'app-topbar',
  styleUrl: './topbar.scss',
  templateUrl: './topbar.html',
})
export class Topbar {
  protected readonly calc = inject(CalculatorService);
  protected readonly themeService = inject(ThemeService);
  protected readonly garage = inject(GarageService);

  onReset(): void {
    if (!window.confirm('Reset every field to its default value? This clears your saved inputs.')) return;
    this.calc.resetToDefaults();
  }
}
