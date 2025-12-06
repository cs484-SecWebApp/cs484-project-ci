import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './LLMNotifications.css';

const API_BASE = 'http://localhost:8080';

const LLMNotificationBell = ({ onReviewClick, activeCourse }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch flagged LLM responses only
  const fetchNotifications = async () => {
    if (!activeCourse) return;
    
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE}/api/posts/classes/${activeCourse.id}/flagged-responses`,
        { withCredentials: true }
      );
      setNotifications(res.data || []);
    } catch (err) {
      console.error('Error fetching flagged responses:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // Poll for new notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [activeCourse]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.reviewed).length;

  const handleNotificationClick = (notification) => {
    setIsOpen(false);
    onReviewClick(notification);
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const truncateText = (text, maxLength = 80) => {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="llm-notification-container" ref={dropdownRef}>
      <button 
        className={`llm-notification-bell ${unreadCount > 0 ? 'has-notifications' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Flagged AI Responses"
      >
        <span className="bell-icon">🚩</span>
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
        )}
      </button>

      {isOpen && (
        <div className="llm-notification-dropdown">
          <div className="notification-header">
            <h3>🚩 Flagged AI Responses</h3>
            <span className="notification-count">
              {unreadCount} need review
            </span>
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-empty">
                <span className="loading-spinner">⏳</span>
                <p>Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="notification-empty">
                <span className="empty-icon">✨</span>
                <p>No flagged responses</p>
                <span className="empty-hint">Students can flag AI responses that need your review</span>
              </div>
            ) : (
              notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`notification-item ${!notification.reviewed ? 'unread' : ''}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    {notification.reviewed ? (
                      <span className="status-icon reviewed">✓</span>
                    ) : notification.flagged ? (
                      <span className="status-icon flagged">⚠️</span>
                    ) : (
                      <span className="status-icon pending">●</span>
                    )}
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">
                      {truncateText(notification.postTitle, 50)}
                    </div>
                    <div className="notification-preview">
                      {truncateText(notification.llmResponsePreview, 80)}
                    </div>
                    {notification.flagReason && (
                      <div className="notification-flag-reason">
                        💬 "{truncateText(notification.flagReason, 60)}"
                      </div>
                    )}
                    <div className="notification-meta">
                      <span className="notification-time">
                        {formatTime(notification.createdAt)}
                      </span>
                      {notification.flagged && (
                        <span className="flagged-badge">
                          Flagged{notification.flaggedByName ? ` by ${notification.flaggedByName}` : ''}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="notification-arrow">→</div>
                </div>
              ))
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-footer">
              <button 
                className="view-all-btn"
                onClick={() => {
                  setIsOpen(false);
                }}
              >
                View All Flagged Responses
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LLMNotificationBell;