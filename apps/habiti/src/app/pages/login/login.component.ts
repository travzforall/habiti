import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  formData = {
    email: 'test@test.com',
    password: '1234',
    rememberMe: false,
  };

  errors: any = {};
  isLoading = false;
  showRegistrationSuccess = false;

  constructor(
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['registered'] === 'true') {
        this.showRegistrationSuccess = true;
      }
    });
  }

  validateForm(): boolean {
    this.errors = {};

    if (!this.formData.email) {
      this.errors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.formData.email)) {
      this.errors.email = 'Invalid email format';
    }

    if (!this.formData.password) {
      this.errors.password = 'Password is required';
    }

    return Object.keys(this.errors).length === 0;
  }

  onSubmit() {
    if (!this.validateForm()) {
      return;
    }

    this.isLoading = true;

    this.authService
      .login(this.formData.email, this.formData.password, this.formData.rememberMe)
      .subscribe({
        next: (user) => {
          const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
          this.router.navigateByUrl(returnUrl);
        },
        error: (error) => {
          this.errors.general = error.message || 'Invalid email or password';
          this.isLoading = false;
        },
        complete: () => {
          this.isLoading = false;
        },
      });
  }
}
