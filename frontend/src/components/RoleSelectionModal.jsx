import React, { useState } from 'react';
import './RoleSelectionModal.css';

function RoleSelectionModal({ onRoleSelect, userName }) {
  const [loading, setLoading] = useState(false);

  const handleRoleSelect = async (role) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('jwt_token');
      
      // Call backend to update user role
      const response = await fetch('http://localhost:8080/api/accounts/me/role', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        throw new Error('Failed to set role');
      }

      // Clear the role selection flag
      sessionStorage.removeItem('showRoleSelection');
      onRoleSelect(role);
    } catch (err) {
      console.error('Error setting role:', err);
      alert('Failed to set role. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="role-modal-overlay">
      <div className="role-modal">
        <h2>Welcome, {userName}!</h2>
        <p>Are you a student or an instructor?</p>

        <div className="role-buttons">
          <button
            className="role-button student-button"
            onClick={() => handleRoleSelect('ROLE_USER')}
            disabled={loading}
          >
            <span className="role-icon">👨‍🎓</span>
            <span className="role-text">Student</span>
          </button>

          <button
            className="role-button instructor-button"
            onClick={() => handleRoleSelect('ROLE_ADMIN')}
            disabled={loading}
          >
            <span className="role-icon">👨‍🏫</span>
            <span className="role-text">Instructor</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default RoleSelectionModal;
