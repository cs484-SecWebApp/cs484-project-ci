import React, { useState } from 'react';
import './PostView.css';
import ChatWidget from './ChatWidget';

const API_BASE = 'http://localhost:8080';

const PostView = ({
  post,
  currentUser,
  courseId,   
  onBack,
  onLLMReply,
  onFollowupSubmit,
  onLikeUpdated,
  onPostUpdated,
}) => {
  const [upvoted, setUpvoted] = useState(post.currentUserLiked || false);
  const [upvoteCount, setUpvoteCount] = useState(post.upvotes || 0);
  const [starred, setStarred] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [followupAuthor, setFollowupAuthor] = useState(post.followupAuthor || '');
  const [isAILoading, setIsAILoading] = useState(false);

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatAiReply, setChatAiReply] = useState(null);

  // NEW: Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);

  const isMyPost = post.author === currentUser;
  const followups = post.followups || [];

  const handleUpvote = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/posts/${post.id}/like`, {
        method: 'POST',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setUpvoted(data.liked);
        setUpvoteCount(data.likeCount);
        
        if (onLikeUpdated) {
          onLikeUpdated(post.id, data.liked, data.likeCount);
        }
      }
    } catch (err) {
      console.error('Error toggling like:', err);
    }
  };

  const handleStar = () => setStarred(!starred);

  const handleFlagReply = async (replyId) => {
    try {
      await fetch(`${API_BASE}/api/posts/${post.id}/replies/${replyId}/flag`, {
        method: 'PUT',
        credentials: 'include',
      });

      alert('Flagged for instructor review.');
    } catch (err) {
      console.error(err);
      alert('Failed to flag reply');
    }
  };

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    alert('Link copied to clipboard!');
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(post.title);
    setEditContent(post.content);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditTitle(post.title);
    setEditContent(post.content);
  };

  const handleSaveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) {
      alert('Title and content cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/posts/${post.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle,
          body: editContent,
        }),
      });

      if (response.ok) {
        const updatedPost = await response.json();
        
        // Update local state
        setIsEditing(false);
        
        // Notify parent component
        if (onPostUpdated) {
          onPostUpdated(updatedPost);
        }
        
      } else {
        alert('Failed to update post');
      }
    } catch (err) {
      console.error('Error updating post:', err);
      alert('Error updating post');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAIAssist = async () => {
    setIsAILoading(true);
    try {
      await onLLMReply(post.id, followupText);
      setFollowupAuthor('🤖');
      setFollowupText('');
    } catch (err) {
      console.error(err);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleFollowupSubmit = async () => {
    if (!followupText.trim()) return;
    try {
      await onFollowupSubmit(post.id, followupText, replyingToId);
      setFollowupAuthor(currentUser);
      setFollowupText('');
      setReplyingToId(null);
      setReplyingToAuthor(null);
    } catch (err) {
      console.error(err);
    }
  };

  const buildReplyingTo = (replies) => {
    const map = new Map();
    replies.forEach((r) => map.set(r.id, { ...r, children: [] }));

    const roots = [];
    map.forEach((reply) => {
      if (reply.parentReplyId) {
        const parent = map.get(reply.parentReplyId);
        if (parent) {
          parent.children.push(reply);
        } else {
          roots.push(reply);
        }
      } else {
        roots.push(reply);
      }
    });
    return roots;
  };

  const replyTree = buildReplyingTo(followups);

  const renderReplies = (nodes, depth = 0) =>
    nodes.map((followup) => (
      <div
        key={followup.id}
        className={`followup-item ${followup.isLLMReply ? 'ai-reply' : ''}`}
        style={{ marginLeft: depth * 24 }}
      >
        <div className="followup-meta">
          <span className="followup-author">
            {followup.isLLMReply ? 'AI Tutor' : followup.author}
          </span>
          <span className="followup-time">{followup.time}</span>
        </div>

        <div className="followup-content">{followup.content}</div>

        <button
          className="reply-btn"
          onClick={() => {
            setReplyingToId(followup.id);
            setReplyingToAuthor(
              followup.isLLMReply ? 'AI Tutor' : followup.author
            );
          }}
        >
          Reply
        </button>

        {followup.isLLMReply && (
          <>
            <button
              className="flag-btn"
              onClick={() => handleFlagReply(followup.id)}
            >
              🚩 Flag for Instructor
            </button>

            <button
              className="discuss-more"
              onClick={() => {
                setChatAiReply(followup.content);
                setIsChatOpen(true);
              }}
            >
              Let's talk more
            </button>
          </>
        )}

        {followup.children &&
          followup.children.length > 0 &&
          renderReplies(followup.children, depth + 1)}
      </div>
    ));


  const wasEdited = post.modifiedAt && post.createdAt && 
    new Date(post.modifiedAt).getTime() !== new Date(post.createdAt).getTime();

  return (
    <div className="post-view">
      {/* Breadcrumb Navigation */}
      <div className="post-nav">
        <button className="back-btn" onClick={onBack}>
          ←
        </button>
      </div>

      {/* Post Header */}
      <div className="post-header">
        <div className="post-header-left">
          <div className="post-number">
            <span className="question-icon">?</span>
            <span className="post-type">{post.type}</span>
            <span className="post-id">@{post.number}</span>
          </div>
          <button className="more-options">⋮</button>
        </div>
      </div>

      {/* Edit Mode */}
      {isEditing ? (
        <div className="edit-mode">
          <div className="edit-header">
            <h2>Edit Post</h2>
          </div>
          
          <div className="edit-form">
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                className="edit-title-input"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Post title"
              />
            </div>
            
            <div className="form-group">
              <label>Content</label>
              <textarea
                className="edit-content-input"
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Post content"
                rows={10}
              />
            </div>
            
            <div className="edit-actions">
              <button 
                className="cancel-edit-btn" 
                onClick={handleCancelEdit}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button 
                className="save-edit-btn" 
                onClick={handleSaveEdit}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Post Title */}
          <h1 className="post-title">{post.title}</h1>

          {/* Post Meta */}
          <div className="post-meta-info">
            <span className="post-updated">
              Updated {post.updatedAt} by {post.author}
            </span>
            {wasEdited && (
              <span className="edited-badge">
                <strong>• EDITED</strong>
              </span>
            )}
          </div>

          {/* Post Content */}
          <div className="post-body">{post.content}</div>

          {/* Post Tags */}
          {post.tags && post.tags.length > 0 && (
            <div className="post-tags">
              {post.tags.map((tag, index) => (
                <span key={index} className="post-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Post Actions */}
          <div className="post-actions">
            {isMyPost && (
              <button className="action-btn edit-btn" onClick={handleEdit}>
                <span className="edit-icon">✎</span> Edit
              </button>
            )}
            <button
              className={`action-btn upvote-btn ${upvoted ? 'active' : ''}`}
              onClick={handleUpvote}
            >
              <span className="thumbs-up-icon">👍</span>{' '}
              {upvoteCount}
            </button>
            <button
              className={`action-btn star-btn ${starred ? 'active' : ''}`}
              onClick={handleStar}
            >
              <span className="star-icon">{starred ? '★' : '☆'}</span>
            </button>
            <button className="action-btn bookmark-btn">
              <span className="bookmark-icon">📖</span>
            </button>
            <button className="action-btn link-btn" onClick={handleCopyLink}>
              <span className="link-icon">🔗</span>
            </button>
            <button
              className={`action-btn ai-btn ${isAILoading ? 'loading' : ''}`}
              onClick={handleAIAssist}
              disabled={isAILoading}
            >
              {isAILoading ? (
                <>
                  <span className="ai-loading-spinner"></span>
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <span className="ai-icon">🤖</span> AI
                </>
              )}
            </button>
          </div>

          {/* Students' Answer Section */}
          <div className="answer-section student-answer-section">
            <div className="section-header">
              <div className="section-icon student-icon">S</div>
              <h2 className="section-title">Students' Answer</h2>
            </div>
            <div className="section-subtitle">
              Where students collectively construct a single answer
            </div>

            {post.studentAnswer ? (
              <div className="answers-list">
                <div className="answer-item">
                  <div className="answer-content">{post.studentAnswer}</div>
                </div>
              </div>
            ) : (
              <div className="empty-answer">Click to start off the wiki answer</div>
            )}
          </div>

          {/* Instructors' Answer Section */}
          <div className="answer-section instructor-answer-section">
            <div className="section-header">
              <div className="section-icon instructor-icon">I</div>
              <h2 className="section-title">Instructors' Answer</h2>
            </div>
            <div className="section-subtitle">Updated by instructor</div>

            {post.instructorAnswer ? (
              <div className="answers-list">
                <div className="answer-item">
                  <div className="answer-content">{post.instructorAnswer}</div>
                </div>
              </div>
            ) : (
              <div className="empty-answer">No instructor answer yet</div>
            )}
          </div>

          {/* AI Answer Section - Only show if there is an AI answer */}
          {post.aiAnswer && (
            <div className="answer-section ai-answer-section">
              <div className="section-header">
                <div className="section-icon ai-icon-section">🤖</div>
                <h2 className="section-title">AI-Generated Answer</h2>
              </div>
              <div className="section-subtitle">
                Generated by Gemini AI assistant
              </div>

              <div className="answers-list">
                <div className="answer-item ai-answer">
                  <div className="answer-content">{post.aiAnswer}</div>
                </div>
              </div>
            </div>
          )}

          {/* Followup Discussions Section */}
          <div className="followup-section">
            <div className="section-header followup-header">
              <div className="section-icon followup-icon">💬</div>
              <h2 className="section-title">
                {followups.length} Followup Discussion
                {followups.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {/* Existing Followups */}
            {followups.length > 0 ? (
              <div className="followups-list">{renderReplies(replyTree)}</div>
            ) : (
              <div className="no-followups">No followup discussions yet</div>
            )}

            {/* New Followup Input */}
            <div className="new-followup">
              {replyingToId && (
                <div className="replying-to-banner">
                  Replying to <strong>{replyingToAuthor}</strong>
                  <button
                    className="cancel-reply-btn"
                    onClick={() => {
                      setReplyingToId(null);
                      setReplyingToAuthor(null);
                    }}
                  >
                    ×
                  </button>
                </div>
              )}

              <textarea
                className="followup-input"
                placeholder="Compose a new followup discussion"
                value={followupText}
                onChange={(e) => setFollowupText(e.target.value)}
              />
              {followupText && (
                <button
                  className="submit-followup-btn"
                  onClick={handleFollowupSubmit}
                >
                  Post Followup
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* LLM chat widget for "Let's talk more" */}
      {isChatOpen && chatAiReply && (
        <ChatWidget
          post={post}
          courseId={courseId} 
          aiReply={chatAiReply}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
};

export default PostView;