# User Management System Setup Guide

## Overview
This guide covers the complete setup of the user authentication and management system for the Habiti Angular application, including database integration with Baserow.

## Components Created

### 1. Angular Components
- **Login Component** (`src/app/pages/login/`)
  - Email/password authentication
  - Remember me functionality
  - Error handling and validation
  - Registration success message display

- **Registration Component** (`src/app/pages/register/`)
  - User registration form
  - Client-side validation
  - Password confirmation
  - Integration with auth service

### 2. Services
- **AuthService** (`src/app/services/auth.service.ts`)
  - JWT token management
  - User session handling
  - Login/logout functionality
  - Registration and profile updates
  - Password reset functionality
  - Token refresh mechanism

### 3. Guards
- **AuthGuard** (`src/app/guards/auth.guard.ts`)
  - Route protection
  - Automatic redirect to login
  - Return URL preservation

### 4. Database Schema

#### Core Tables Created:

**users** - Main user profile table
- Authentication fields (email, password_hash, username)
- Profile data (names, bio, avatar)
- Preferences and settings
- Gamification data (points, level, streaks)
- Security flags (verified, active, locked)

**user_sessions** - Active user sessions
- JWT token management
- Device and location tracking
- Session expiration handling

**user_devices** - Device registration for push notifications
- Device fingerprinting
- Push notification tokens
- Security monitoring

**audit_logs** - Security and compliance logging
- All user actions tracked
- IP address and device logging
- Change history for sensitive data

**email_verifications** - Email verification workflow
- Registration verification
- Email change verification
- Password reset tokens

**user_permissions** - Granular permission system
- Role-based access control
- Resource-specific permissions
- Time-based permissions

## Installation Steps

### 1. Database Setup

Import the table schemas into your Baserow database:

```bash
# Navigate to the project directory
cd /Users/travz/Documents/Work/habiti/habiti

# Import each schema file into Baserow
# Use the JSON files in database-schemas/ directory:
# - users-table-schema.json
# - user-sessions-table-schema.json
# - user-devices-table-schema.json
# - audit-logs-table-schema.json
# - email-verifications-table-schema.json
# - user-roles-permissions-schema.json
```

### 2. Sample Data Import

Import sample user data:

```bash
# Import sample users
# Use import-data/sample-users-data.json
```

### 3. Link Existing Tables

Update your existing habit-related tables to reference the new users table:

1. **habits table** - Add user_id field linking to users table
2. **entries table** - Link to users via habit relationship
3. **game-state table** - Link user_id to users table
4. **user-settings table** - Link user_id to users table
5. **user-achievements table** - Link user_id to users table

### 4. API Backend Setup

Create API endpoints to support the Angular service:

#### Required Endpoints:

```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/refresh
POST /api/auth/verify-email/:token
POST /api/auth/reset-password
POST /api/auth/reset-password/confirm
PUT /api/auth/profile
GET /api/auth/me
```

#### Example Response Format:

```json
{
  "user": {
    "id": "user_001",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "username": "johndoe",
    "role": "user",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00Z"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 5. Environment Configuration

Add authentication configuration to your environment files:

```typescript
// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  tokenKey: 'auth_token',
  refreshTokenKey: 'refresh_token'
};
```

### 6. JWT Token Configuration

Configure JWT tokens in your backend:

```javascript
// Example JWT configuration
const jwtConfig = {
  secret: process.env.JWT_SECRET,
  accessTokenExpiry: '15m',
  refreshTokenExpiry: '7d',
  issuer: 'habiti-app',
  audience: 'habiti-users'
};
```

## Integration with Existing App

### 1. Update Existing Components

Modify existing components to use the current user:

```typescript
import { AuthService } from '../services/auth.service';

constructor(private authService: AuthService) {}

ngOnInit() {
  this.authService.currentUser.subscribe(user => {
    if (user) {
      // Load user-specific data
      this.loadUserHabits(user.id);
    }
  });
}
```

### 2. Filter Data by User

Update all data queries to filter by current user:

```typescript
// Example: Filter habits by current user
getHabits() {
  const userId = this.authService.currentUserValue?.id;
  if (userId) {
    return this.baserowService.getHabits(userId);
  }
}
```

### 3. Add User Context to Forms

Include user_id when creating new records:

```typescript
createHabit(habitData: any) {
  const userId = this.authService.currentUserValue?.id;
  const habitWithUser = {
    ...habitData,
    user_id: userId
  };
  return this.baserowService.createHabit(habitWithUser);
}
```

## Security Considerations

### 1. Password Security
- Passwords hashed with bcrypt (cost factor 12+)
- Minimum 8 character requirement
- Consider password strength requirements

### 2. Session Management
- JWT tokens with short expiry (15 minutes)
- Refresh token rotation
- Session invalidation on logout

### 3. Email Verification
- Required for new accounts
- Tokens expire after 24 hours
- Rate limiting on verification requests

### 4. Account Lockout
- Lock account after 5 failed login attempts
- Temporary lockout (15 minutes)
- Email notification on lockout

### 5. Audit Logging
- Log all authentication events
- Track sensitive data changes
- IP address and device monitoring

## Testing

### 1. Test User Accounts

Use the sample data for testing:
- **john.doe@example.com** (Pro user)
- **jane.smith@example.com** (Free user)  
- **admin@habiti.com** (Admin user)

Default password for all test accounts: `password123`

### 2. Test Scenarios

1. **Registration Flow**
   - Valid registration
   - Duplicate email/username
   - Invalid email format
   - Password mismatch

2. **Login Flow**
   - Valid credentials
   - Invalid credentials
   - Unverified email
   - Locked account

3. **Session Management**
   - Token expiration
   - Refresh token flow
   - Logout functionality

4. **Password Reset**
   - Request reset email
   - Use reset token
   - Expired token handling

## Deployment Checklist

- [ ] Database tables created in production
- [ ] Sample data imported (if needed)
- [ ] API endpoints implemented
- [ ] JWT secrets configured
- [ ] Email service configured
- [ ] SSL certificates installed
- [ ] Rate limiting enabled
- [ ] Monitoring and logging setup
- [ ] Backup strategy implemented

## Monitoring and Maintenance

### 1. Key Metrics to Monitor
- Login success/failure rates
- Session duration
- Password reset requests
- Failed authentication attempts
- Account lockouts

### 2. Regular Maintenance
- Review audit logs weekly
- Clean up expired sessions
- Monitor for suspicious activity
- Update security policies

### 3. Performance Optimization
- Index frequently queried fields
- Cache user session data
- Optimize JWT token size
- Monitor database query performance

## Support and Troubleshooting

### Common Issues

1. **Login Not Working**
   - Check email verification status
   - Verify password hash
   - Check account lockout status

2. **Token Errors**
   - Verify JWT secret configuration
   - Check token expiration
   - Validate token format

3. **Email Verification Issues**
   - Check email service configuration
   - Verify token generation
   - Check token expiration

### Getting Help

For technical support or questions about this user management system:
1. Check the audit logs for error details
2. Review the API response codes
3. Verify database connectivity
4. Check Angular console for client-side errors

---

This user management system provides a robust foundation for user authentication and authorization in your Habiti application, with full integration into your existing habit tracking database structure.