import React, { useState, useEffect } from 'react';
import StudentDashboard from './components/StudentDashboard';
import InstructorDashboard from './components/InstructorDashboard';
import LoginPage from './components/LoginPage';
import './App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstructor, setIsInstructor] = useState(false);

  // Check if user is already logged in on mount
  useEffect(() => {
    checkAuthStatus();
  }, []);

  
const checkAuthStatus = async () => {
  try {
    const response = await fetch(`https://cs484-project-ci-cd.onrender.com/api/auth/me`, {
      credentials: 'include',
    });

    if (!response.ok) {
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
    console.log('Not authenticated');
  } finally {
    setIsLoading(false);
  }
};

  const handleLogin = async (userData) => {
    try {
      const response = await fetch(
        'https://cs484-project-ci-cd.onrender.com/api/auth/login',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: userData.email,
            password: userData.password,
          }),
          credentials: 'include',
        }
      );

      console.log('Login response status:', response.status);

      if (response.status === 401) {
        throw new Error('Invalid email or password');
      }

      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        console.error(
          'Non-OK /api/auth/login response body (first 200 chars):',
          text.slice(0, 200)
        );
        throw new Error(text || `Login failed with status ${response.status}`);
      }

      if (!contentType.includes('application/json')) {
        const text = await response.text().catch(() => '');
        console.error(
          'Unexpected non-JSON /api/auth/login response:',
          text.slice(0, 200)
        );
        throw new Error('Server returned an unexpected response while logging in');
      }

      // This is the Account entity the backend returns
      const accountData = await response.json();
      console.log('Account data from /api/auth/login:', accountData);

      const hasAdminRole =
        accountData.authorities?.some(
          (auth) => auth.name === 'ROLE_ADMIN'
        ) || false;

      setIsInstructor(hasAdminRole);
      setUser({ ...accountData, isInstructor: hasAdminRole });
      setIsAuthenticated(true);

      return true;
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed: ' + error.message);
      throw error;
    }
  };


  const handleRegister = async (userData) => {
    try {
      const response = await fetch('https://cs484-project-ci-cd.onrender.com/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: userData.fullName,
          email: userData.email,
          password: userData.password,
          role: userData.role,
          classCodes: userData.classCodes || []
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const registeredAccount = await response.json();
        console.log('Registered account:', registeredAccount); // Debug log
        
        // After successful registration, log them in
        // Need to wait a brief moment for the registration to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await handleLogin({
          email: userData.email,
          password: userData.password,
          role: userData.role
        });
      } else {
        const error = await response.text();
        throw new Error(error || 'Registration failed');
      }
    } catch (error) {
      console.error('Registration error:', error);
      alert('Registration failed: ' + error.message);
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('https://cs484-project-ci-cd.onrender.com/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setIsInstructor(false);
    }
  };

  if (isLoading) {
    return (
      <div className="App" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="App">
      {isAuthenticated ? (
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
      ) : (
        <LoginPage onLogin={handleLogin} onRegister={handleRegister} />
      )}
    </div>
  );
}

export default App;




































































