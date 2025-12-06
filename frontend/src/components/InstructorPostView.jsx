import React, { useState } from 'react';
import axios from 'axios';
import './InstructorPostView.css';

const API_BASE = 'http://localhost:8080';

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
  onEndorseStudentAnswer,
  onBack,
  onRefreshPost,
}) => {
  const [upvoted, setUpvoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [instructorReplyText, setInstructorReplyText] = useState('');
  const [followupText, setFollowupText] = useState('');

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);
  
  // Student answer endorsement state
  const [isEndorsingStudentAnswer, setIsEndorsingStudentAnswer] = useState(false);


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

  // Handle endorsing the student wiki answer
  const handleEndorseStudentAnswer = async () => {
    setIsEndorsingStudentAnswer(true);
    try {
      await axios.put(
        `${API_BASE}/api/posts/${post.id}/student-answer/endorse`,
        {},
        { withCredentials: true }
      );
      
      // Refresh the post to show updated endorsement
      if (onRefreshPost) {
        onRefreshPost();
      }
    } catch (err) {
      console.error('Error endorsing student answer:', err);
      alert('Failed to endorse student answer');
    } finally {
      setIsEndorsingStudentAnswer(false);
    }
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

  // Determine the display type for a reply
  const getReplyDisplayType = (followup) => {
    if (followup.replacedByInstructor) {
      return 'instructor'; // Completely replaced by instructor
    }
    if ((followup.isLLMReply || followup.llmGenerated) && followup.instructorEdited) {
      return 'instructor-ai'; // AI edited by instructor
    }
    if ((followup.isLLMReply || followup.llmGenerated) && followup.endorsed && !followup.instructorEdited) {
      return 'ai-endorsed'; // AI endorsed but not edited
    }
    if (followup.isLLMReply || followup.llmGenerated) {
      return 'ai'; // Regular AI response
    }
    if (followup.fromInstructor) {
      return 'instructor'; // Regular instructor post
    }
    return 'student'; // Student response
  };

  const renderReplies = (nodes, depth = 0) =>
    nodes.map((followup) => {
      const displayType = getReplyDisplayType(followup);
      
      // Debug log to help troubleshoot display issues
      if (followup.instructorEdited || followup.endorsed || followup.replacedByInstructor) {
        console.log('InstructorPostView - Reply display:', {
          id: followup.id,
          isLLMReply: followup.isLLMReply,
          llmGenerated: followup.llmGenerated,
          instructorEdited: followup.instructorEdited,
          replacedByInstructor: followup.replacedByInstructor,
          endorsed: followup.endorsed,
          fromInstructor: followup.fromInstructor,
          displayType
        });
      }
      
      return (
      <div
        key={followup.id}
        className={`followup-item ${(followup.isLLMReply || followup.llmGenerated) ? 'ai-reply' : ''} ${followup.endorsed ? 'endorsed' : ''} ${followup.instructorEdited ? 'edited' : ''} ${followup.flagged ? 'flagged-reply' : ''} ${followup.replacedByInstructor ? 'instructor-answer' : ''} ${displayType === 'instructor-ai' ? 'instructor-ai-answer' : ''}`}
        style={{ marginLeft: depth * 24 }}
      >
        <div className="followup-meta">
          <span className="followup-author">
            {/* Author display based on type */}
            {displayType === 'instructor' && `👨‍🏫 ${followup.editedByName || followup.author || 'Instructor'}`}
            {displayType === 'instructor-ai' && '🤖 Instructor-AI'}
            {displayType === 'ai-endorsed' && '🤖 AI Tutor'}
            {displayType === 'ai' && '🤖 AI Tutor'}
            {displayType === 'student' && followup.author}
          </span>
          
          {/* Badge: Instructor Answer (replaced AI or direct instructor post) */}
          {displayType === 'instructor' && followup.replacedByInstructor && (
            <span className="instructor-badge">Instructor Answer</span>
          )}
          
          {/* Badge: Instructor-AI Answer (edited by instructor) */}
          {displayType === 'instructor-ai' && (
            <span className="instructor-ai-badge">
              ✏️ Edited by {followup.editedByName || 'Instructor'}
            </span>
          )}
          
          {/* Badge: AI Endorsed (approved but not edited) */}
          {displayType === 'ai-endorsed' && (
            <span className="endorsed-badge">✓ INSTRUCTOR APPROVED</span>
          )}
          
          {/* Badge: Flagged (under review) */}
          {(followup.isLLMReply || followup.llmGenerated) && followup.flagged && !followup.endorsed && (
            <span className="flagged-badge">🚩 Flagged by Student</span>
          )}
          
          <span className="followup-time">
            {followup.editedAt || followup.time}
          </span>
        </div>

        <div className="followup-content">{followup.content}</div>

        {/* Verification Message based on type */}
        {displayType === 'instructor-ai' && (
          <div className="endorsement-message instructor-ai-message">
            ✓ This AI response was reviewed and improved by {followup.editedByName || 'instructor'}
          </div>
        )}
        {displayType === 'ai-endorsed' && (
          <div className="endorsement-message">
            ✓ This AI response has been verified by instructor
          </div>
        )}

        <div className="followup-actions">
          <button
            className="reply-btn"
            onClick={() => {
              setReplyingToId(followup.id);
              setReplyingToAuthor(
                displayType === 'instructor' ? (followup.editedByName || followup.author || 'Instructor') :
                displayType === 'instructor-ai' ? 'Instructor-AI' :
                displayType.startsWith('ai') ? 'AI Tutor' : followup.author
              );
            }}
          >
            Reply
          </button>
          
          {/* Endorse button for AI responses */}
          {(followup.isLLMReply || followup.llmGenerated) && !followup.replacedByInstructor && !followup.endorsed && onEndorseReply && (
            <button
              className="endorse-btn"
              onClick={() => onEndorseReply(post.id, followup.id)}
            >
              ✓ Endorse
            </button>
          )}
        </div>

        {followup.children &&
          followup.children.length > 0 &&
          renderReplies(followup.children, depth + 1)}
      </div>
    );
  });

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
          {post.studentAnswerEndorsed && (
            <span className="endorsed-badge section-badge">✓ ENDORSED</span>
          )}
        </div>
        <div className="section-subtitle">
          Where students collectively construct a single answer
        </div>

        {post.studentAnswer ? (
          <div className="answers-list">
            <div className={`answer-item ${post.studentAnswerEndorsed ? 'endorsed-answer' : ''}`}>
              {post.studentAnswerEndorsed && (
                <div className="endorsement-message">
                  ✓ You have endorsed this student answer
                </div>
              )}
              <div className="answer-content">{post.studentAnswer}</div>
              <div className="answer-meta">
                {post.studentAnswerAuthor && (
                  <span className="answer-author">Last edited by {post.studentAnswerAuthor}</span>
                )}
                {post.studentAnswerUpdatedAt && (
                  <span className="answer-time">{post.studentAnswerUpdatedAt}</span>
                )}
              </div>
              {!post.studentAnswerEndorsed && (
                <div className="answer-actions">
                  <button
                    className="endorse-btn"
                    onClick={handleEndorseStudentAnswer}
                    disabled={isEndorsingStudentAnswer}
                  >
                    {isEndorsingStudentAnswer ? 'Endorsing...' : '✓ Endorse Answer'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="empty-answer">
            No student answer yet
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