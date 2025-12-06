import React, { createContext, useContext, useState, useEffect } from 'react';

// Create the Auth Context
const AuthContext = createContext(null);

/**
 * AuthProvider wraps your app and provides authentication state and methods.
 * It checks if the user is logged in on mount and manages login/logout using JWT tokens.
 */
export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstructor, setIsInstructor] = useState(false);

  // Check authentication status on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  /**
   * Fetch the current user from the backend using JWT token.
   * If successful, set user and authenticated state.
   * If 401/403, user is not authenticated.
   */
  const checkAuthStatus = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      
      if (!token) {
        setIsLoading(false);
        return;
      }

      const response = await fetch('http://localhost:8080/api/accounts/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        // Token is invalid or expired
        localStorage.removeItem('jwt_token');
        setIsLoading(false);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        setIsLoading(false);
        return;
      }

      const accountData = await response.json();
      const hasAdminRole =
        accountData.authorities?.some((auth) => auth.name === 'ROLE_ADMIN') || false;

      setIsInstructor(hasAdminRole);
      setUser(accountData);
      setIsAuthenticated(true);
    } catch (err) {
      console.log('Not authenticated:', err.message);
      localStorage.removeItem('jwt_token');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Login with email and password.
   * Called by login form; stores user state if successful.
   */
  const login = async (email, password) => {
    try {
      const response = await fetch('http://localhost:8080/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const accountData = await response.json();
      const hasAdminRole =
        accountData.authorities?.some((auth) => auth.name === 'ROLE_ADMIN') || false;

      setIsInstructor(hasAdminRole);
      setUser(accountData);
      setIsAuthenticated(true);
      return true;
    } catch (err) {
      console.error('Login error:', err);
      return false;
    }
  };

  /**
   * Logout: clear JWT token and reset local state.
   */
  const logout = async () => {
    try {
      const token = localStorage.getItem('jwt_token');
      if (token) {
        await fetch('http://localhost:8080/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('jwt_token');
      setIsAuthenticated(false);
      setUser(null);
      setIsInstructor(false);
    }
  };

  /**
   * Redirect to Google OAuth2 login on the backend.
   */
  const loginWithGoogle = () => {
    window.location.href = 'http://localhost:8080/oauth2/authorization/google';
  };

  const value = {
    isAuthenticated,
    user,
    isLoading,
    isInstructor,
    login,
    logout,
    loginWithGoogle,
    checkAuthStatus, // Expose for manual re-check if needed
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Custom hook to use the AuthContext.
 * Usage: const auth = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
