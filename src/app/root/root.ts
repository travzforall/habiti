import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TopNavComponent } from '../components/top-nav/top-nav';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopNavComponent],
  templateUrl: './root.html',
  styleUrl: './root.scss'
})
export class RootComponent {
}