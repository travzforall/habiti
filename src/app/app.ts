import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { TopNavComponent } from './components/top-nav/top-nav';
import { BottomNavComponent } from './components/bottom-nav/bottom-nav';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, TopNavComponent, BottomNavComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {
  
  ngOnInit(): void {
    // Initialize theme on app startup
    this.applyTheme();
  }

  private applyTheme(): void {
    const savedTheme = localStorage.getItem('habiti-theme') || 'auto';
    const htmlElement = document.documentElement;
    
    if (savedTheme === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      htmlElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
    } else {
      htmlElement.setAttribute('data-theme', savedTheme);
    }
  }
}