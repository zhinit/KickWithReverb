# Auth Error Handling Improvement Plan

## Overview

Add user-friendly error feedback to login and registration forms. Errors display as a red banner at the top of each form with the HTTP status code prefixed to a friendly message.

## Error Messages

### Registration (400 errors)
| Backend Error | User Message |
|--------------|--------------|
| Username already exists | "400: Username is already taken" |
| Password too short | "400: Password must be at least 8 characters" |
| Invalid email | "400: Please enter a valid email address" |
| Multiple errors | Combined: "400: Username is already taken. Password must be at least 8 characters." |
| Server error | "500: Something went wrong. Please try again." |
| Network failure | "Lost in transit. Please try again." |

### Login (401 errors)
| Backend Error | User Message |
|--------------|--------------|
| Invalid credentials | "401: Invalid username or password" |
| Server error | "500: Something went wrong. Please try again." |
| Network failure | "Lost in transit. Please try again." |

## Implementation Steps

### 1. Update `react/src/utils/api.ts`
- Modify `loginUser` and `registerUser` to return structured objects with status and parsed error data
- Handle network failures (fetch throws) vs HTTP errors

### 2. Create error mapping utility
- New file: `react/src/utils/authErrors.ts`
- Function: `mapAuthError(status: number | null, errorData: object, context: 'login' | 'register'): string`
- Maps backend error responses to friendly messages

### 3. Update `react/src/hooks/useAuth.tsx`
- Change `login()` return type from `Promise<boolean>` to `Promise<string | null>` (null = success, string = error message)
- Change `register()` return type similarly
- Call error mapping utility on failures

### 4. Update `react/src/components/LoginForm.tsx`
- Update to handle new return type from `login()`
- Display returned error message in red banner

### 5. Update `react/src/components/RegisterForm.tsx`
- Update to handle new return type from `register()`
- Display returned error message in red banner

### 6. Add error banner styles to `react/src/App.css`
- Red text/background styling for `.error` class (if not already present)
