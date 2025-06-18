import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-help',
  standalone: true,
  imports: [],
  templateUrl: './app-help.component.html',
  styleUrl: './app-help.component.css'
})
export class AppHelpComponent {
  @Input() isComponentActive : boolean = false;
  
}
