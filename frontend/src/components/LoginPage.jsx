import React, { useState } from 'react';
import './LoginPage.css';

const LoginPage = ({ onLogin, onRegister }) => {
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