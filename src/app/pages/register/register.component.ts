import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MINIMUM_AGE, isAdult, latestAdultBirthDate, parseDateOnly } from '@habiti/util';

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
    username: '',
    dateOfBirth: ''
  };

  errors: any = {};
  isLoading = false;

  /** Bound to the date input's `max`, so the picker cannot offer an under-18 date. */
  readonly maxBirthDate = latestAdultBirthDate();
  readonly minimumAge = MINIMUM_AGE;
  
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

    // Habiti is 18+. The date is checked here rather than trusting the input's
    // `max`, which a user can bypass by typing.
    if (!this.formData.dateOfBirth) {
      this.errors.dateOfBirth = 'Date of birth is required';
    } else if (!parseDateOnly(this.formData.dateOfBirth)) {
      this.errors.dateOfBirth = 'Enter a valid date';
    } else if (!isAdult(this.formData.dateOfBirth)) {
      this.errors.dateOfBirth = `You must be at least ${MINIMUM_AGE} to use Habiti`;
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