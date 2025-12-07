import React from 'react';
import './UserDropDown.css';

const UserDropdown = ({ isOpen, onClose, onJoinClass, onLogout, userName }) => {
  if (!isOpen) return null;

  const handleJoinClass = () => {
    onJoinClass();
    onClose();
  };

  const handleLogout = () => {
    onLogout();
    onClose();
  };

  return (
    <>
      <div className="dropdown-backdrop" onClick={onClose}></div>
      <div className="user-dropdown">
        <div className="user-dropdown-header">
          <div className="user-dropdown-avatar">
            {userName.split(' ').map(n => n[0]).join('')}
          </div>
          <span className="user-dropdown-name">{userName}</span>
        </div>
        
        <div className="user-dropdown-menu">
          <button className="dropdown-menu-item" onClick={handleJoinClass}>
            <span className="menu-icon">➜</span>
            Join Another Class
          </button>
          
          <button className="dropdown-menu-item logout" onClick={handleLogout}>
            <span className="menu-icon">🚪</span>
            Log Out
          </button>
        </div>
      </div>
    </>
  );
};

export default UserDropdown;