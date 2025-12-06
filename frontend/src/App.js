import React, { useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import StudentDashboard from './components/StudentDashboard';
import InstructorDashboard from './components/InstructorDashboard';
import SignupPage from './components/SignupPage';
import RoleSelectionModal from './components/RoleSelectionModal';
import { useAuth } from './context/AuthContext';
import './App.css';

function App() {
  const { isAuthenticated, user, isLoading, isInstructor, logout, checkAuthStatus } = useAuth();
  const [showSignup, setShowSignup] = useState(false);
  const [showRoleSelection, setShowRoleSelection] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Extract JWT token from URL after OAuth redirect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    
    if (token) {
      // Store JWT token in localStorage
      localStorage.setItem('jwt_token', token);
      
      // Remove token from URL
      const cleanUrl = window.location.pathname + window.location.hash.split('?')[0];
      window.history.replaceState({}, document.title, cleanUrl);
      
      // Check auth status with new token
      checkAuthStatus();
    }
  }, [location, checkAuthStatus]);

  // Check auth status on mount and after OAuth redirects back
  useEffect(() => {
    checkAuthStatus();
    // Re-check after delays in case we just came back from OAuth redirect
    const timer1 = setTimeout(() => {
      checkAuthStatus();
    }, 500);
    const timer2 = setTimeout(() => {
      checkAuthStatus();
    }, 1500);
    const timer3 = setTimeout(() => {
      checkAuthStatus();
    }, 3000);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [checkAuthStatus]);

  // Check if we need to show role selection modal
  useEffect(() => {
    const needsRoleSelection = sessionStorage.getItem('showRoleSelection') === 'true';
    if (isAuthenticated && needsRoleSelection && user) {
      setShowRoleSelection(true);
    }
  }, [isAuthenticated, user]);


  const handleLogout = async () => {
    await logout();
  };

  // Welcome/Login page
  const WelcomePage = () => {
    if (isLoading) {
      return (
        <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <div>Loading...</div>
        </div>
      );
    }

    if (showSignup) {
      return <SignupPage />;
    }

    return (
      <div className="App welcome-container">
        <div className="welcome-card">
          <h1 className="welcome-title">piazza</h1>
          <p className="welcome-subtitle">Learn together. Anywhere.</p>

          <div className="welcome-buttons">
            <button
              className="welcome-button google-signin"
              onClick={() => {
                sessionStorage.setItem('showRoleSelection', 'true');
                window.location.href = 'http://localhost:8080/oauth2/authorization/google';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

            <button
              className="welcome-button create-account"
              onClick={() => setShowSignup(true)}
            >
              Create an Account
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Show role selection modal if needed
  if (showRoleSelection && isAuthenticated) {
    return (
      <RoleSelectionModal
        userName={user?.firstName || user?.name || 'User'}
        onRoleSelect={() => {
          setShowRoleSelection(false);
          checkAuthStatus(); // Re-fetch user with new role
        }}
      />
    );
  }

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<WelcomePage />} />
      <Route path="/" element={isAuthenticated ? (
        isInstructor ? (
          <InstructorDashboard 
            onLogout={handleLogout} 
            userName={
              user?.firstName 
                ? `${user.firstName} ${user.lastName || ''}`.trim()
                : user?.name || user?.fullName || 'Instructor'
            } 
          />
        ) : (
          <StudentDashboard 
            onLogout={handleLogout} 
            userName={
              user?.firstName 
                ? `${user.firstName} ${user.lastName || ''}`.trim()
                : user?.name || user?.fullName || 'User'
            } 
          />
        )
      ) : <Navigate to="/login" />} />
    </Routes>
  );
}

export default App;




































































