import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './LLMNotifications.css';

const API_BASE = 'http://localhost:8080';

const LLMReviewModal = ({ isOpen, onClose, notification, onUpdate }) => {
  const [llmResponse, setLlmResponse] = useState('');
  const [editedResponse, setEditedResponse] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [postDetails, setPostDetails] = useState(null);
  const [conversationHistory, setConversationHistory] = useState([]);

  useEffect(() => {
    if (isOpen && notification) {
      fetchPostDetails();
    }
  }, [isOpen, notification]);

  const fetchPostDetails = async () => {
    if (!notification?.postId) return;
    
    try {
      setLoading(true);
      const res = await axios.get(
        `${API_BASE}/api/posts/${notification.postId}`,
        { withCredentials: true }
      );
      
      setPostDetails(res.data);
      
      // Find the LLM reply
      const llmReply = res.data.replies?.find(r => r.id === notification.replyId);
      if (llmReply) {
        setLlmResponse(llmReply.body);
        setEditedResponse(llmReply.body);
      }

      // Build conversation history
      const history = res.data.replies?.map(r => ({
        id: r.id,
        author: r.llmGenerated ? 'AI Tutor' : 
                (r.author ? `${r.author.firstName} ${r.author.lastName}` : 'Unknown'),
        content: r.body,
        isLLM: r.llmGenerated,
        endorsed: r.endorsed,
        time: r.createdAt
      })) || [];
      
      setConversationHistory(history);
    } catch (err) {
      console.error('Error fetching post details:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEndorse = async () => {
    try {
      setActionLoading('endorse');
      await axios.put(
        `${API_BASE}/api/posts/${notification.postId}/replies/${notification.replyId}/endorse`,
        {},
        { withCredentials: true }
      );
      
      // Mark as reviewed
      await axios.put(
        `${API_BASE}/api/posts/${notification.postId}/replies/${notification.replyId}/review`,
        { reviewed: true, feedback: 'Endorsed by instructor' },
        { withCredentials: true }
      );

      onUpdate && onUpdate();
      onClose();
    } catch (err) {
      console.error('Error endorsing response:', err);
      alert('Failed to endorse response');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateResponse = async () => {
    if (!editedResponse.trim()) {
      alert('Response cannot be empty');
      return;
    }

    try {
      setActionLoading('update');
      
      // Update the LLM response with instructor's edits
      await axios.put(
        `${API_BASE}/api/posts/${notification.postId}/replies/${notification.replyId}`,
        { 
          body: editedResponse,
          instructorEdited: true,
          feedback: feedback || 'Edited by instructor'
        },
        { withCredentials: true }
      );

      // Mark as reviewed
      await axios.put(
        `${API_BASE}/api/posts/${notification.postId}/replies/${notification.replyId}/review`,
        { reviewed: true, feedback: feedback || 'Response updated by instructor' },
        { withCredentials: true }
      );

      onUpdate && onUpdate();
      onClose();
    } catch (err) {
      console.error('Error updating response:', err);
      alert('Failed to update response');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReplace = async () => {
    if (!editedResponse.trim()) {
      alert('Response cannot be empty');
      return;
    }

    try {
      setActionLoading('replace');
      
      // Replace the LLM response entirely with instructor answer
      await axios.put(
        `${API_BASE}/api/posts/${notification.postId}/replies/${notification.replyId}/replace`,
        { 
          body: editedResponse,
          feedback: feedback || 'Replaced by instructor'
        },
        { withCredentials: true }
      );

      onUpdate && onUpdate();
      onClose();
    } catch (err) {
      console.error('Error replacing response:', err);
      alert('Failed to replace response');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async () => {
    try {
      setActionLoading('dismiss');
      
      // Just mark as reviewed without changes
      await axios.put(
        `${API_BASE}/api/posts/${notification.postId}/replies/${notification.replyId}/review`,
        { reviewed: true, feedback: 'Dismissed without changes' },
        { withCredentials: true }
      );

      onUpdate && onUpdate();
      onClose();
    } catch (err) {
      console.error('Error dismissing:', err);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="llm-modal-overlay" onClick={onClose}>
      <div className="llm-modal" onClick={(e) => e.stopPropagation()}>
        <div className="llm-modal-header">
          <div className="modal-title-section">
            <span className="modal-icon">🤖</span>
            <div>
              <h2>Review AI Response</h2>
              <p className="modal-subtitle">
                {notification?.flagged && <span className="flagged-indicator">⚠️ Flagged by student</span>}
              </p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="llm-modal-loading">
            <span className="loading-spinner">⏳</span>
            <p>Loading conversation...</p>
          </div>
        ) : (
          <div className="llm-modal-content">
            {/* Original Question */}
            <div className="conversation-section">
              <h3 className="section-label">📝 Original Question</h3>
              <div className="question-card">
                <div className="question-title">{postDetails?.title}</div>
                <div className="question-body">{postDetails?.body}</div>
                <div className="question-meta">
                  Posted by {postDetails?.account?.firstName} {postDetails?.account?.lastName}
                </div>
              </div>
            </div>

            {/* Conversation History */}
            {conversationHistory.length > 0 && (
              <div className="conversation-section">
                <h3 className="section-label">💬 Conversation</h3>
                <div className="conversation-thread">
                  {conversationHistory.map((msg, idx) => (
                    <div 
                      key={msg.id} 
                      className={`conversation-message ${msg.isLLM ? 'llm-message' : 'user-message'} ${msg.id === notification?.replyId ? 'highlighted' : ''}`}
                    >
                      <div className="message-header">
                        <span className="message-author">
                          {msg.isLLM ? '🤖 ' : '👤 '}{msg.author}
                        </span>
                        {msg.endorsed && <span className="endorsed-badge">✓ Endorsed</span>}
                      </div>
                      <div className="message-content">{msg.content}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI Response Editor */}
            <div className="conversation-section">
              <h3 className="section-label">
                🤖 AI Response 
                {!isEditing && (
                  <button 
                    className="edit-toggle-btn"
                    onClick={() => setIsEditing(true)}
                  >
                    ✏️ Edit
                  </button>
                )}
              </h3>
              
              {isEditing ? (
                <div className="response-editor">
                  <textarea
                    value={editedResponse}
                    onChange={(e) => setEditedResponse(e.target.value)}
                    className="response-textarea"
                    placeholder="Edit the AI response..."
                    rows={8}
                  />
                  <div className="editor-hint">
                    ✨ Your edits help improve future AI responses
                  </div>
                </div>
              ) : (
                <div className="response-preview">
                  {llmResponse}
                </div>
              )}
            </div>

            {/* Feedback Section */}
            <div className="conversation-section">
              <h3 className="section-label">📋 Feedback (Optional)</h3>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="feedback-textarea"
                placeholder="Add notes about why you're making these changes (helps improve AI)..."
                rows={3}
              />
            </div>
          </div>
        )}

        <div className="llm-modal-actions">
          <div className="action-group secondary">
            <button 
              className="action-btn dismiss"
              onClick={handleDismiss}
              disabled={actionLoading}
            >
              {actionLoading === 'dismiss' ? 'Dismissing...' : 'Dismiss'}
            </button>
          </div>
          
          <div className="action-group primary">
            {isEditing ? (
              <>
                <button 
                  className="action-btn cancel"
                  onClick={() => {
                    setIsEditing(false);
                    setEditedResponse(llmResponse);
                  }}
                  disabled={actionLoading}
                >
                  Cancel Edit
                </button>
                <button 
                  className="action-btn replace"
                  onClick={handleReplace}
                  disabled={actionLoading}
                >
                  {actionLoading === 'replace' ? 'Replacing...' : '🔄 Replace Response'}
                </button>
                <button 
                  className="action-btn update"
                  onClick={handleUpdateResponse}
                  disabled={actionLoading}
                >
                  {actionLoading === 'update' ? 'Saving...' : '💾 Save & Endorse'}
                </button>
              </>
            ) : (
              <button 
                className="action-btn endorse"
                onClick={handleEndorse}
                disabled={actionLoading}
              >
                {actionLoading === 'endorse' ? 'Endorsing...' : '✓ Endorse Response'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLMReviewModal;