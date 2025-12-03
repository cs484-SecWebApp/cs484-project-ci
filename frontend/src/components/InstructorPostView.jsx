import React, { useState } from 'react';
import './InstructorPostView.css';

const InstructorPostView = ({
  posts = [],
  pinnedPosts = [],
  selectedPost,
  loading,
  error,
  onPostClick,        // unused for now
  onFilterClick,      // unused for now
  selectedFilter,     // unused for now
  onInstructorReply,  // EXPECTS: (postId, text, parentReplyId?)
  onEndorseReply,
  onBack,
}) => {
  const [upvoted, setUpvoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [instructorReplyText, setInstructorReplyText] = useState('');
  const [followupText, setFollowupText] = useState('');

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);


  const allPosts = [...pinnedPosts, ...posts].filter(Boolean);
  const activePost =
    (selectedPost && selectedPost.id && selectedPost) ||
    allPosts[0] ||
    null;

  const post = activePost;


  if (!post) {
    if (loading) {
      return <div className="no-posts-placeholder">Loading posts…</div>;
    }
    if (error) {
      return <div className="no-posts-placeholder">{error}</div>;
    }
    return (
      <div className="no-posts-placeholder">
        No posts yet. Click <strong>New Post</strong> to start the discussion.
      </div>
    );
  }

  // ===== Basic actions =====
  const handleUpvote = () => setUpvoted(prev => !prev);
  const handleStar = () => setStarred(prev => !prev);

  const handleCopyLink = () => {
    const postUrl = `${window.location.origin}/post/${post.id}`;
    navigator.clipboard.writeText(postUrl);
    alert('Link copied to clipboard!');
  };

  const handleEdit = () => {
    console.log('Edit post:', post.id);
  };

  // ===== Instructor “answer” (top I-section) =====
  const handleInstructorReplySubmit = async () => {
    if (!instructorReplyText.trim() || !onInstructorReply) return;

    try {
      // top-level instructor answer => no parentReplyId
      await onInstructorReply(post.id, instructorReplyText, null);
      setInstructorReplyText('');
    } catch (err) {
      console.error(err);
    }
  };

  // ===== Followup (threaded replies, like PostView) =====
  const handleFollowupSubmit = async () => {
    if (!followupText.trim() || !onInstructorReply) return;

    try {
      await onInstructorReply(post.id, followupText, replyingToId || null);
      setFollowupText('');
      setReplyingToId(null);
      setReplyingToAuthor(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndorseClick = (replyId) => {
    if (!onEndorseReply) return;
    onEndorseReply(post.id, replyId);
  };

  // ===== Build reply tree from post.followups (similar to PostView) =====
  const followups = post.followups || []; // normalized in InstructorDashboard

  const buildReplyTree = (replies) => {
    const map = new Map();
    replies.forEach((r) => {
      map.set(r.id, { ...r, children: [] });
    });

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

  const replyTree = buildReplyTree(followups);

  const renderReplies = (nodes, depth = 0) =>
    nodes.map((followup) => (
      <div
        key={followup.id}
        className={`followup-item ${
          followup.isLLMReply || followup.llmGenerated ? 'ai-reply' : ''
        }`}
        style={{ marginLeft: depth * 24 }}
      >
        <div className="followup-meta">
          <span className="followup-author">
            {followup.isLLMReply || followup.llmGenerated ? 'AI Tutor' : followup.author}
          </span>
          <span className="followup-time">{followup.time}</span>
        </div>

        <div className="followup-content">{followup.content}</div>

        <button
          className="reply-btn"
          onClick={() => {
            setReplyingToId(followup.id);
            setReplyingToAuthor(
              followup.isLLMReply || followup.llmGenerated ? 'AI Tutor' : followup.author
            );
          }}
        >
          Reply
        </button>

        {followup.children &&
          followup.children.length > 0 &&
          renderReplies(followup.children, depth + 1)}
      </div>
    ));

  // ===== Render =====
  return (
    <div className="instructor-post-view">
      {/* Breadcrumb Navigation */}
      <div className="post-nav">
        {onBack && (
          <button className="back-btn" onClick={onBack}>
            ←
          </button>
        )}
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
        <button className="action-btn edit-btn" onClick={handleEdit}>
          <span className="edit-icon">✎</span> Edit
        </button>
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

        {post.studentReplies && post.studentReplies.length > 0 ? (
          <div className="answers-list">
            {post.studentReplies.map((reply, index) => (
              <div key={reply.id || index} className="answer-item">
                <div className="answer-meta">
                  <span className="answer-author">{reply.author}</span>
                  <span className="answer-time">{reply.time}</span>
                </div>
                <div className="answer-content">{reply.content}</div>
                <div className="answer-actions">
                  <button
                    className={`endorse-btn ${
                      reply.endorsed ? 'endorsed' : ''
                    }`}
                    onClick={() => handleEndorseClick(reply.id)}
                  >
                    {reply.endorsed
                      ? '✓ Endorsed by Instructor'
                      : 'Endorse'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-answer">
            <textarea
              className="answer-input"
              placeholder="Click to start off the wiki answer"
            />
          </div>
        )}
      </div>

      {/* Instructors' Answer Section */}
      <div className="answer-section instructor-answer-section">
        <div className="section-header">
          <div className="section-icon instructor-icon">I</div>
          <h2 className="section-title">Instructors' Answer</h2>
        </div>
        <div className="section-subtitle">
          Updated{' '}
          {post.instructorReplies && post.instructorReplies.length > 0
            ? post.instructorReplies[post.instructorReplies.length - 1].time
            : 'never'}{' '}
          by{' '}
          {post.instructorReplies && post.instructorReplies.length > 0
            ? post.instructorReplies[post.instructorReplies.length - 1].author
            : 'instructor'}
        </div>

        {post.instructorReplies && post.instructorReplies.length > 0 ? (
          <div className="answers-list">
            {post.instructorReplies.map((reply, index) => (
              <div key={reply.id || index} className="answer-item">
                <div className="answer-meta">
                  <span className="answer-author">{reply.author}</span>
                  <span className="answer-time">{reply.time}</span>
                </div>
                <div className="answer-content">{reply.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="answer-input-container">
            <textarea
              className="answer-input"
              placeholder="Write your instructor answer here..."
              value={instructorReplyText}
              onChange={(e) => setInstructorReplyText(e.target.value)}
            />
            {instructorReplyText && (
              <button
                className="submit-answer-btn"
                onClick={handleInstructorReplySubmit}
              >
                Post Instructor Answer
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Answer Section – replies with llmGenerated=true */}
      {post.aiReplies && post.aiReplies.length > 0 && (
        <div className="answer-section ai-answer-section">
          <div className="section-header">
            <div className="section-icon ai-icon">🤖</div>
            <h2 className="section-title">AI-Generated Answer</h2>
          </div>
          <div className="section-subtitle">
            Generated by Gemini AI assistant
          </div>

          <div className="answers-list">
            {post.aiReplies.map((reply, index) => (
              <div key={reply.id || index} className="answer-item ai-answer">
                <div className="answer-meta">
                  <span className="answer-author">AI Tutor</span>
                  <span className="answer-time">{reply.time}</span>
                </div>
                <div className="answer-content">{reply.content}</div>
                <div className="answer-actions">
                  <button
                    className={`endorse-btn ${
                      reply.endorsed ? 'endorsed' : ''
                    }`}
                    onClick={() => handleEndorseClick(reply.id)}
                  >
                    {reply.endorsed
                      ? '✓ Endorsed by Instructor'
                      : 'Endorse'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Followup Discussions Section (threaded) */}
      <div className="followup-section">
        <div className="section-header followup-header">
          <div className="section-icon followup-icon">💬</div>
          <h2 className="section-title">
            {followups.length} Followup Discussion
            {followups.length !== 1 ? 's' : ''}
          </h2>
        </div>

        {followups.length > 0 ? (
          <div className="followups-list">{renderReplies(replyTree)}</div>
        ) : (
          <div className="no-followups">No followup discussions yet</div>
        )}

        {/* New Followup Input (with “Replying to” banner like PostView) */}
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
    </div>
  );
};

export default InstructorPostView;
