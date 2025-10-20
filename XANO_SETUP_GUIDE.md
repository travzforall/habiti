# Xano Authentication Setup Guide

## Overview
This guide will help you set up Xano as the authentication backend for your Habiti Angular application.

## Xano Database Setup

### 1. Create Xano Account and Workspace
1. Go to [Xano.com](https://xano.com) and create an account
2. Create a new workspace for your Habiti application
3. Note your workspace URL (format: `https://your-workspace-id.us-east-1.xano.io`)

### 2. Create Users Table
Create a table called `users` with the following fields:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  username VARCHAR(50) UNIQUE,
  role VARCHAR(20) DEFAULT 'user',
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  profile_image VARCHAR(500),
  bio TEXT,
  total_points INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  streak_count INTEGER DEFAULT 0,
  best_streak INTEGER DEFAULT 0,
  onboarding_completed BOOLEAN DEFAULT false,
  preferences JSON,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login TIMESTAMP
);
```

### 3. Create Authentication API Endpoints

#### A. POST /auth/signup (User Registration)
**Input Variables:**
- `email` (text, required)
- `password` (text, required) 
- `first_name` (text, required)
- `last_name` (text, required)
- `username` (text, required)

**Function Logic:**
```javascript
// Check if email already exists
const existingUser = await this.db.users.getFirstWhere({
  email: inputs.email
});

if (existingUser) {
  throw new Error('Email already registered');
}

// Check if username already exists
const existingUsername = await this.db.users.getFirstWhere({
  username: inputs.username
});

if (existingUsername) {
  throw new Error('Username already taken');
}

// Hash password
const hashedPassword = await this.bcrypt.hash(inputs.password, 10);

// Create user
const newUser = await this.db.users.create({
  email: inputs.email,
  password: hashedPassword,
  first_name: inputs.first_name,
  last_name: inputs.last_name,
  username: inputs.username,
  role: 'user',
  is_active: true,
  total_points: 0,
  level: 1,
  streak_count: 0,
  best_streak: 0,
  onboarding_completed: false
});

// Generate JWT token
const payload = {
  user_id: newUser.id,
  email: newUser.email,
  role: newUser.role
};

const authToken = await this.jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '7d'
});

// Return user and token (exclude password)
return {
  user: {
    id: newUser.id,
    email: newUser.email,
    first_name: newUser.first_name,
    last_name: newUser.last_name,
    username: newUser.username,
    role: newUser.role,
    is_active: newUser.is_active,
    created_at: newUser.created_at
  },
  authToken: authToken
};
```

#### B. POST /auth/login (User Login)
**Input Variables:**
- `email` (text, required)
- `password` (text, required)

**Function Logic:**
```javascript
// Find user by email
const user = await this.db.users.getFirstWhere({
  email: inputs.email
});

if (!user) {
  throw new Error('Invalid email or password');
}

// Check if account is active
if (!user.is_active) {
  throw new Error('Account is inactive');
}

// Verify password
const passwordValid = await this.bcrypt.compare(inputs.password, user.password);

if (!passwordValid) {
  throw new Error('Invalid email or password');
}

// Update last login
await this.db.users.update(user.id, {
  last_login: new Date()
});

// Generate JWT token
const payload = {
  user_id: user.id,
  email: user.email,
  role: user.role
};

const authToken = await this.jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '7d'
});

// Return user and token (exclude password)
return {
  user: {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    role: user.role,
    is_active: user.is_active,
    created_at: user.created_at,
    last_login: user.last_login
  },
  authToken: authToken
};
```

#### C. GET /auth/me (Get Current User)
**Authentication:** Required (JWT Bearer token)

**Function Logic:**
```javascript
// Get user ID from JWT token
const userId = this.jwt.user_id;

// Find user
const user = await this.db.users.getFirstWhere({
  id: userId
});

if (!user) {
  throw new Error('User not found');
}

// Return user data (exclude password)
return {
  id: user.id,
  email: user.email,
  first_name: user.first_name,
  last_name: user.last_name,
  username: user.username,
  role: user.role,
  is_active: user.is_active,
  created_at: user.created_at,
  last_login: user.last_login,
  total_points: user.total_points,
  level: user.level,
  streak_count: user.streak_count,
  best_streak: user.best_streak,
  onboarding_completed: user.onboarding_completed,
  preferences: user.preferences
};
```

#### D. POST /auth/logout (User Logout)
**Authentication:** Required (JWT Bearer token)

**Function Logic:**
```javascript
// In Xano, you can implement token blacklisting or simply return success
// Since JWTs are stateless, logout is mainly handled client-side

return {
  message: 'Logged out successfully'
};
```

#### E. POST /auth/refresh (Refresh Token)
**Authentication:** Required (JWT Bearer token)

**Function Logic:**
```javascript
// Get user ID from current token
const userId = this.jwt.user_id;

// Generate new token
const payload = {
  user_id: userId,
  email: this.jwt.email,
  role: this.jwt.role
};

const newAuthToken = await this.jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: '7d'
});

return {
  authToken: newAuthToken
};
```

#### F. PATCH /users/update (Update User Profile)
**Authentication:** Required (JWT Bearer token)
**Input Variables:**
- `first_name` (text, optional)
- `last_name` (text, optional)
- `email` (text, optional)
- `profile_image` (text, optional)
- `bio` (text, optional)

**Function Logic:**
```javascript
const userId = this.jwt.user_id;

// Build update object with only provided fields
const updateData = {};
if (inputs.first_name) updateData.first_name = inputs.first_name;
if (inputs.last_name) updateData.last_name = inputs.last_name;
if (inputs.email) updateData.email = inputs.email;
if (inputs.profile_image) updateData.profile_image = inputs.profile_image;
if (inputs.bio) updateData.bio = inputs.bio;

updateData.updated_at = new Date();

// Update user
const updatedUser = await this.db.users.update(userId, updateData);

// Return updated user data
return {
  id: updatedUser.id,
  email: updatedUser.email,
  first_name: updatedUser.first_name,
  last_name: updatedUser.last_name,
  username: updatedUser.username,
  profile_image: updatedUser.profile_image,
  bio: updatedUser.bio,
  updated_at: updatedUser.updated_at
};
```

## Environment Configuration

Update your `src/environments/environment.ts` file with your actual Xano workspace URL:

```typescript
export const environment = {
  production: false,
  xano: {
    apiUrl: 'https://YOUR-WORKSPACE-ID.us-east-1.xano.io/api:v1', // Replace with your actual workspace URL
    endpoints: {
      auth: {
        login: '/auth/login',
        register: '/auth/signup', 
        logout: '/auth/logout',
        refresh: '/auth/refresh',
        me: '/auth/me'
      },
      users: {
        update: '/users/update'
      }
    }
  }
};
```

## Environment Variables in Xano

Set these environment variables in your Xano workspace:

1. **JWT_SECRET**: A strong secret key for signing JWT tokens
   ```
   JWT_SECRET=your-super-secret-jwt-key-here-make-it-long-and-random
   ```

## Testing the Setup

### 1. Test Registration
```bash
curl -X POST https://YOUR-WORKSPACE-ID.us-east-1.xano.io/api:v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User",
    "username": "testuser"
  }'
```

### 2. Test Login
```bash
curl -X POST https://YOUR-WORKSPACE-ID.us-east-1.xano.io/api:v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123"
  }'
```

### 3. Test Protected Endpoint
```bash
curl -X GET https://YOUR-WORKSPACE-ID.us-east-1.xano.io/api:v1/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

## Integration with Habiti App

Once your Xano endpoints are set up:

1. **Update Environment**: Replace `YOUR-WORKSPACE-ID` with your actual workspace ID
2. **Test Authentication**: Try logging in with your Angular app
3. **Monitor Logs**: Check Xano's function logs for any errors
4. **Verify Database**: Ensure users are being created in your Xano users table

## Troubleshooting

### Common Issues:

1. **CORS Errors**: Make sure your Xano API allows requests from your Angular app domain
2. **JWT Errors**: Verify your JWT_SECRET is set correctly in Xano environment variables
3. **Database Errors**: Check that your users table has all required fields
4. **Email Validation**: Ensure email field has proper validation and unique constraint

### Debug Mode:
Enable debug mode in your Angular app to see detailed error messages:

```typescript
// In auth.service.ts
console.log('Login request:', loginData);
console.log('Login response:', response);
```

## Security Considerations

1. **JWT Expiration**: Set appropriate token expiration times
2. **Password Hashing**: Always use bcrypt with proper salt rounds (10+)
3. **Rate Limiting**: Implement rate limiting on login attempts
4. **HTTPS Only**: Ensure all API calls use HTTPS in production
5. **Input Validation**: Validate all input data in Xano functions

---

Your authentication system is now ready to use Xano as the backend! The Angular app will automatically handle JWT tokens and user sessions.