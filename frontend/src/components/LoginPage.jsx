import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './LoginPage.css';

const LoginPage = ({ onLogin, onRegister }) => {
  const { loginWithGoogle } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('student');
  const [classCodes, setClassCodes] = useState(['']);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onLogin({ email, password });
    } catch (error) {
      // Error is already handled in App.js
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onRegister({ 
        email, 
        password, 
        fullName, 
        role: role === 'professor' ? 'instructor' : role, // Map professor to instructor for backend
        classCodes: role === 'student' ? classCodes.filter(code => code.trim() !== '') : []
      });
    } catch (error) {
      // Error is already handled in App.js
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddClassCode = () => {
    setClassCodes([...classCodes, '']);
  };

  const handleClassCodeChange = (index, value) => {
    const newCodes = [...classCodes];
    newCodes[index] = value;
    setClassCodes(newCodes);
  };

  const handleRemoveClassCode = (index) => {
    const newCodes = classCodes.filter((_, i) => i !== index);
    setClassCodes(newCodes);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        <div className="login-header">
          <h1 className="piazza-logo">piazza</h1>
          <p className="login-subtitle">Learn together. Anywhere.</p>
        </div>

        {!isRegistering ? (
          /* Login Form */
          <form className="login-form" onSubmit={handleLogin}>
            <h2 className="form-title">Log In</h2>
            
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log In'}
            </button>

            <div className="divider">
              <span>Or</span>
            </div>

            <button 
              type="button" 
              className="google-login-btn" 
              onClick={loginWithGoogle}
              disabled={isLoading}
            >
              <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign in with Google
            </button>

            <div className="form-footer">
              <p>Don't have an account? 
                <button 
                  type="button"
                  className="switch-form-btn" 
                  onClick={() => setIsRegistering(true)}
                >
                  Sign Up
                </button>
              </p>
            </div>
          </form>
        ) : (
          /* Registration Form */
          <form className="login-form" onSubmit={handleRegister}>
            <h2 className="form-title">Create Account</h2>
            
            <div className="form-group">
              <label htmlFor="fullName">Full Name</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-email">Email</label>
              <input
                id="reg-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="reg-password">Password</label>
              <input
                id="reg-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label>I am a:</label>
              <div className="role-selector">
                <label className="radio-label">
                  <input
                    type="radio"
                    value="student"
                    checked={role === 'student'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  <span>Student</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    value="instructor"
                    checked={role === 'instructor'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  <span>Professor</span>
                </label>
              </div>
            </div>

            {role === 'student' && (
              <div className="form-group">
                <label>Class Access Codes (Optional)</label>
                <p className="field-hint">Enter class codes to join classes immediately</p>
                {classCodes.map((code, index) => (
                  <div key={index} className="class-code-row">
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => handleClassCodeChange(index, e.target.value)}
                      placeholder="Enter class code"
                      className="form-input class-code-input"
                    />
                    {classCodes.length > 1 && (
                      <button
                        type="button"
                        className="remove-code-btn"
                        onClick={() => handleRemoveClassCode(index)}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button 
                  type="button"
                  className="add-code-btn" 
                  onClick={handleAddClassCode}
                >
                  + Add Another Class Code
                </button>
              </div>
            )}

            <button type="submit" className="submit-btn" disabled={isLoading}>
              {isLoading ? 'Creating Account...' : 'Create Account'}
            </button>

            <div className="form-footer">
              <p>Already have an account? 
                <button 
                  type="button"
                  className="switch-form-btn" 
                  onClick={() => setIsRegistering(false)}
                >
                  Log In
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default LoginPage;