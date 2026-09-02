import { Component, inject } from '@angular/core';
import { TooltipService } from '../../services/tooltip.service';

@Component({
  imports: [],
  selector: 'app-tooltip',
  styleUrl: './tooltip.scss',
  templateUrl: './tooltip.html',
})
export class Tooltip {
  protected readonly tooltip = inject(TooltipService);
}
