import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  formData = {
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    username: ''
  };
  
  errors: any = {};
  isLoading = false;
  
  constructor(
    private authService: AuthService,
    private router: Router
  ) {}
  
  validateForm(): boolean {
    this.errors = {};
    
    if (!this.formData.email) {
      this.errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
      this.errors.email = 'Invalid email format';
    }
    
    if (!this.formData.password) {
      this.errors.password = 'Password is required';
    } else if (this.formData.password.length < 8) {
      this.errors.password = 'Password must be at least 8 characters';
    }
    
    if (this.formData.password !== this.formData.confirmPassword) {
      this.errors.confirmPassword = 'Passwords do not match';
    }
    
    if (!this.formData.firstName) {
      this.errors.firstName = 'First name is required';
    }
    
    if (!this.formData.lastName) {
      this.errors.lastName = 'Last name is required';
    }
    
    if (!this.formData.username) {
      this.errors.username = 'Username is required';
    } else if (this.formData.username.length < 3) {
      this.errors.username = 'Username must be at least 3 characters';
    }
    
    return Object.keys(this.errors).length === 0;
  }
  
  onSubmit() {
    if (!this.validateForm()) {
      return;
    }
    
    this.isLoading = true;
    
    this.authService.register(this.formData).subscribe({
      next: (response) => {
        this.router.navigate(['/login'], { queryParams: { registered: 'true' } });
      },
      error: (error) => {
        this.errors.general = error.message || 'Registration failed';
        this.isLoading = false;
      },
      complete: () => {
        this.isLoading = false;
      }
    });
  }
}