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
}) => {
  const [upvoted, setUpvoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [followupAuthor, setFollowupAuthor] = useState(post.followupAuthor || '');
  const [isAILoading, setIsAILoading] = useState(false);

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatAiReply, setChatAiReply] = useState(null);

  const isMyPost = post.author === currentUser;
  const followups = post.followups || [];

  const handleUpvote = () => setUpvoted(!upvoted);
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
    console.log('Edit post:', post.id);
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

  return (
    <div className="post-view">
      {/* Breadcrumb Navigation */}
      <div className="post-nav">
        <button className="back-btn" onClick={onBack}>
          ←
        </button>
        <button className="history-btn">
          <span className="clock-icon">🕐</span> Question History
        </button>
        <span className="nav-divider">|</span>
        <span className="no-history">No history yet</span>
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

      {/* Post Title */}
      <h1 className="post-title">{post.title}</h1>

      {/* Post Meta */}
      <div className="post-meta-info">
        <span className="post-updated">
          Updated {post.updatedAt} by {post.author}
        </span>
      </div>

      {/* Post Content */}
      <div
        className="post-body"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

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
          {post.upvotes + (upvoted ? 1 : 0)}
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
        <div className="post-views">
          <span className="views-count">{post.views} views</span>
        </div>
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
