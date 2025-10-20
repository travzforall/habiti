import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { BehaviorSubject, Observable, map, throwError, switchMap } from 'rxjs';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  created_at: number;
  name: string;
  email: string;
  bio?: string;
  date_of_birth?: string;
  location?: string;
  profile_picture?: {
    url: string;
  };
  // Legacy fields for compatibility
  firstName?: string;
  lastName?: string;
  username?: string;
  avatar?: string;
  role?: string;
  isActive?: boolean;
  createdAt?: Date;
  lastLogin?: Date;
}

export interface AuthResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUserSubject: BehaviorSubject<User | null>;
  public currentUser: Observable<User | null>;
  private tokenKey = 'auth_token';
  private refreshTokenKey = 'refresh_token';
  private userKey = 'current_user';
  
  constructor(
    private router: Router,
    private http: HttpClient
  ) {
    const storedUser = this.getStoredUser();
    this.currentUserSubject = new BehaviorSubject<User | null>(storedUser);
    this.currentUser = this.currentUserSubject.asObservable();
  }
  
  private xanoApiUrl = environment.xano.apiUrl;
  private xanoEndpoints = environment.xano.endpoints;

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  private getHeaders(token?: string): HttpHeaders {
    const headers: any = {
      'Content-Type': 'application/json'
    };
    
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return new HttpHeaders(headers);
  }

  register(userData: any): Observable<AuthResponse> {
    const registerData = {
      email: userData.email,
      password: userData.password,
      first_name: userData.firstName,
      last_name: userData.lastName,
      username: userData.username
    };

    const url = `${this.xanoApiUrl}${this.xanoEndpoints.auth.register}`;
    
    return this.http.post(url, registerData, { headers: this.getHeaders() }).pipe(
      map((response: any) => {
        console.log('Register response:', response);
        
        // Handle case where user data might not be included
        const user: User = response.user ? {
          id: response.user.id || response.user.user_id || '',
          created_at: response.user.created_at || Date.now(),
          name: response.user.name || `${userData.firstName} ${userData.lastName}`.trim(),
          email: response.user.email || userData.email,
          bio: response.user.bio,
          date_of_birth: response.user.date_of_birth,
          location: response.user.location,
          profile_picture: response.user.profile_picture,
          // Legacy fields for compatibility
          firstName: response.user.first_name || userData.firstName,
          lastName: response.user.last_name || userData.lastName,
          username: response.user.username || userData.username,
          role: response.user.role || 'user',
          isActive: response.user.is_active !== false,
          createdAt: response.user.created_at ? new Date(response.user.created_at) : new Date()
        } : {
          id: response.user_id || '',
          created_at: Date.now(),
          name: `${userData.firstName} ${userData.lastName}`.trim(),
          email: userData.email,
          bio: undefined,
          date_of_birth: undefined,
          location: undefined,
          profile_picture: undefined,
          // Legacy fields for compatibility
          firstName: userData.firstName,
          lastName: userData.lastName,
          username: userData.username,
          role: 'user',
          isActive: true,
          createdAt: new Date()
        };
        
        return {
          user,
          token: response.authToken
        };
      })
    );
  }
  
  login(email: string, password: string, rememberMe: boolean = false): Observable<User> {
    const loginData = {
      email: email,
      password: password
    };

    const url = `${this.xanoApiUrl}${this.xanoEndpoints.auth.login}`;
    
    return this.http.post(url, loginData, { headers: this.getHeaders() }).pipe(
      switchMap((response: any) => {
        console.log('Login response:', response);
        
        if (!response.authToken) {
          throw new Error('Invalid email or password');
        }
        
        // Store the token first
        this.storeToken(response.authToken, rememberMe);
        
        // Now fetch the user data using the token
        const meUrl = `${this.xanoApiUrl}${this.xanoEndpoints.auth.me}`;
        return this.http.get(meUrl, { headers: this.getHeaders(response.authToken) }).pipe(
          map((userResponse: any) => {
            console.log('User data response:', userResponse);
            
            // Use the new User interface structure
            const user: User = {
              id: userResponse.id,
              created_at: userResponse.created_at,
              name: userResponse.name,
              email: userResponse.email || email,
              bio: userResponse.bio,
              date_of_birth: userResponse.date_of_birth,
              location: userResponse.location,
              profile_picture: userResponse.profile_picture,
              // Legacy fields for compatibility
              firstName: userResponse.name ? userResponse.name.split(' ')[0] : '',
              lastName: userResponse.name ? userResponse.name.split(' ').slice(1).join(' ') : '',
              username: userResponse.username || userResponse.email?.split('@')[0] || email.split('@')[0],
              role: userResponse.role || 'user',
              isActive: userResponse.is_active !== false,
              createdAt: userResponse.created_at ? new Date(userResponse.created_at) : new Date(),
              lastLogin: new Date()
            };
            
            this.storeUser(user, rememberMe);
            this.currentUserSubject.next(user);
            
            return user;
          })
        );
      })
    );
  }
  
  logout(): void {
    const token = this.getToken();
    
    if (token) {
      const url = `${this.xanoApiUrl}${this.xanoEndpoints.auth.logout}`;
      
      this.http.post(url, {}, { headers: this.getHeaders(token) }).subscribe({
        next: () => {},
        error: (error) => console.warn('Logout API call failed:', error),
        complete: () => {
          this.clearAuth();
          this.currentUserSubject.next(null);
          this.router.navigate(['/login']);
        }
      });
    } else {
      this.clearAuth();
      this.currentUserSubject.next(null);
      this.router.navigate(['/login']);
    }
  }
  
  updateProfile(userData: Partial<User>): Observable<User> {
    const currentUser = this.currentUserValue;
    const token = this.getToken();
    
    if (!currentUser || !token) {
      return throwError(() => new Error('Not authenticated'));
    }

    const updateData: any = {};
    if (userData.firstName) updateData.first_name = userData.firstName;
    if (userData.lastName) updateData.last_name = userData.lastName;
    if (userData.email) updateData.email = userData.email;
    
    const url = `${this.xanoApiUrl}${this.xanoEndpoints.users.update}`;
    
    return this.http.patch(url, updateData, { headers: this.getHeaders(token) }).pipe(
      map((response: any) => {
        const updatedUser: User = {
          ...currentUser,
          email: response.email || currentUser.email,
          firstName: response.first_name || currentUser.firstName,
          lastName: response.last_name || currentUser.lastName
        };
        
        const storage = localStorage.getItem(this.userKey) ? localStorage : sessionStorage;
        storage.setItem(this.userKey, JSON.stringify(updatedUser));
        this.currentUserSubject.next(updatedUser);
        
        return updatedUser;
      })
    );
  }

  // Get current user profile from Xano
  getCurrentUser(): Observable<User> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('Not authenticated'));
    }
    
    const url = `${this.xanoApiUrl}${this.xanoEndpoints.auth.me}`;
    
    return this.http.get(url, { headers: this.getHeaders(token) }).pipe(
      map((response: any) => {
        console.log('Get current user response:', response);
        
        // Directly use the response structure from the API
        const user: User = {
          id: response.id,
          created_at: response.created_at,
          name: response.name,
          email: response.email,
          bio: response.bio,
          date_of_birth: response.date_of_birth,
          location: response.location,
          profile_picture: response.profile_picture,
          // Add legacy fields for compatibility
          firstName: response.name ? response.name.split(' ')[0] : '',
          lastName: response.name ? response.name.split(' ').slice(1).join(' ') : '',
          username: response.username || response.email?.split('@')[0] || '',
          role: response.role || 'user',
          isActive: response.is_active !== false,
          createdAt: response.created_at ? new Date(response.created_at) : new Date(),
          lastLogin: response.last_login ? new Date(response.last_login) : undefined
        };
        
        this.storeUser(user, !!localStorage.getItem(this.userKey));
        this.currentUserSubject.next(user);
        
        return user;
      })
    );
  }

  // Refresh auth token
  refreshToken(): Observable<string> {
    const token = this.getToken();
    
    if (!token) {
      return throwError(() => new Error('No token available'));
    }
    
    const url = `${this.xanoApiUrl}${this.xanoEndpoints.auth.refresh}`;
    
    return this.http.post(url, {}, { headers: this.getHeaders(token) }).pipe(
      map((response: any) => {
        if (response.authToken) {
          this.storeToken(response.authToken, !!localStorage.getItem(this.tokenKey));
          return response.authToken;
        }
        throw new Error('Token refresh failed');
      })
    );
  }
  
  isAuthenticated(): boolean {
    return !!this.getToken() && !!this.currentUserValue;
  }
  
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey) || sessionStorage.getItem(this.tokenKey);
  }
  
  private getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshTokenKey) || sessionStorage.getItem(this.refreshTokenKey);
  }
  
  private storeToken(token: string, permanent: boolean = false): void {
    const storage = permanent ? localStorage : sessionStorage;
    storage.setItem(this.tokenKey, token);
  }
  
  private storeRefreshToken(token: string, permanent: boolean = false): void {
    const storage = permanent ? localStorage : sessionStorage;
    storage.setItem(this.refreshTokenKey, token);
  }
  
  private storeUser(user: User, permanent: boolean = false): void {
    const storage = permanent ? localStorage : sessionStorage;
    storage.setItem(this.userKey, JSON.stringify(user));
  }
  
  private getStoredUser(): User | null {
    const userData = localStorage.getItem(this.userKey) || sessionStorage.getItem(this.userKey);
    if (userData) {
      try {
        return JSON.parse(userData);
      } catch {
        return null;
      }
    }
    return null;
  }
  
  private clearAuth(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
    sessionStorage.removeItem(this.tokenKey);
    sessionStorage.removeItem(this.refreshTokenKey);
    sessionStorage.removeItem(this.userKey);
  }
}