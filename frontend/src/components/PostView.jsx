import React, { useState } from 'react';
import axios from 'axios';
import './PostView.css';
import ChatWidget from './ChatWidget';

const API_BASE = 'http://localhost:8080';

const PostView = ({
  post,
  currentUser,
  onBack,
  onLLMReply,
  onFollowupSubmit,
  onFlagAIResponse,
  onStudentAnswerSubmit,
  onRefreshPost,
}) => {
  const [upvoted, setUpvoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [followupText, setFollowupText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatAiReply, setChatAiReply] = useState(null);

  // Student Answer editing state
  const [isEditingStudentAnswer, setIsEditingStudentAnswer] = useState(false);
  const [studentAnswerText, setStudentAnswerText] = useState(post.studentAnswer || '');
  const [isSubmittingStudentAnswer, setIsSubmittingStudentAnswer] = useState(false);

  const isMyPost = post.author === currentUser;
  const followups = post.followups || [];

  const handleUpvote = () => setUpvoted(!upvoted);
  const handleStar = () => setStarred(!starred);

  const handleFlagReply = async (replyId) => {
    // If onFlagAIResponse is provided, use the modal approach
    if (onFlagAIResponse) {
      onFlagAIResponse(post.id, replyId);
      return;
    }
    
    // Fallback to direct API call
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
      setFollowupText('');
      setReplyingToId(null);
      setReplyingToAuthor(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Student Answer Handlers
  const handleStudentAnswerClick = () => {
    setStudentAnswerText(post.studentAnswer || '');
    setIsEditingStudentAnswer(true);
  };

  const handleStudentAnswerSubmit = async () => {
    if (!studentAnswerText.trim()) {
      alert('Please enter an answer');
      return;
    }

    setIsSubmittingStudentAnswer(true);
    try {
      await axios.post(
        `${API_BASE}/api/posts/${post.id}/student-answer`,
        { body: studentAnswerText },
        { withCredentials: true }
      );
      
      setIsEditingStudentAnswer(false);
      // Refresh the post to show updated answer
      if (onRefreshPost) {
        onRefreshPost();
      }
    } catch (err) {
      console.error('Error submitting student answer:', err);
      alert('Failed to submit answer');
    } finally {
      setIsSubmittingStudentAnswer(false);
    }
  };

  const handleCancelStudentAnswer = () => {
    setIsEditingStudentAnswer(false);
    setStudentAnswerText(post.studentAnswer || '');
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

  // Determine the display type for a reply
  const getReplyDisplayType = (followup) => {
    // Check if this was originally an AI response (use both flags for safety)
    const isAIResponse = followup.isLLMReply || followup.llmGenerated;
    
    if (followup.replacedByInstructor) {
      return 'instructor'; // Completely replaced by instructor - no longer AI
    }
    if (isAIResponse && followup.instructorEdited) {
      return 'instructor-ai'; // AI edited by instructor
    }
    if (isAIResponse && followup.endorsed && !followup.instructorEdited) {
      return 'ai-endorsed'; // AI endorsed but not edited
    }
    if (isAIResponse) {
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
      
      // Debug log to help troubleshoot
      if (followup.instructorEdited || followup.endorsed) {
        console.log('Reply display:', {
          id: followup.id,
          isLLMReply: followup.isLLMReply,
          llmGenerated: followup.llmGenerated,
          instructorEdited: followup.instructorEdited,
          replacedByInstructor: followup.replacedByInstructor,
          endorsed: followup.endorsed,
          displayType
        });
      }
      
      return (
      <div
        key={followup.id}
        className={`followup-item ${followup.isLLMReply ? 'ai-reply' : ''} ${followup.endorsed ? 'endorsed' : ''} ${followup.instructorEdited ? 'edited' : ''} ${followup.flagged ? 'flagged-reply' : ''} ${followup.replacedByInstructor ? 'instructor-answer' : ''} ${displayType === 'instructor-ai' ? 'instructor-ai-answer' : ''}`}
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
          {followup.isLLMReply && followup.flagged && !followup.endorsed && (
            <span className="flagged-badge">🚩 Under Review</span>
          )}
          
          <span className="followup-time">
            {followup.editedAt ? `${followup.editedAt}` : followup.time}
          </span>
        </div>

        <div className="followup-content">{followup.content}</div>

        {/* Verification Message based on type */}
        {displayType === 'instructor-ai' && (
          <div className="endorsement-message instructor-ai-message">
            ✓ This AI response was reviewed and improved by {followup.editedByName || 'your instructor'}
          </div>
        )}
        {displayType === 'ai-endorsed' && (
          <div className="endorsement-message">
            ✓ This AI response has been verified by your instructor
          </div>
        )}

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

        {followup.isLLMReply && !followup.replacedByInstructor && (
          <>
            {/* Only show flag button if NOT endorsed and NOT already flagged */}
            {!followup.endorsed && !followup.flagged && (
              <button
                className="flag-btn"
                onClick={() => handleFlagReply(followup.id)}
              >
                🚩 Flag for Instructor
              </button>
            )}

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
    );
  });

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
          {post.studentAnswerEndorsed && (
            <span className="endorsed-badge section-badge">✓ INSTRUCTOR ENDORSED</span>
          )}
        </div>
        <div className="section-subtitle">
          Where students collectively construct a single answer
        </div>

        {isEditingStudentAnswer ? (
          <div className="student-answer-editor">
            <textarea
              className="student-answer-textarea"
              value={studentAnswerText}
              onChange={(e) => setStudentAnswerText(e.target.value)}
              placeholder="Write your answer here... You can collaborate with other students to build the best answer."
              rows={6}
            />
            <div className="student-answer-actions">
              <button 
                className="cancel-btn"
                onClick={handleCancelStudentAnswer}
                disabled={isSubmittingStudentAnswer}
              >
                Cancel
              </button>
              <button 
                className="submit-btn"
                onClick={handleStudentAnswerSubmit}
                disabled={isSubmittingStudentAnswer}
              >
                {isSubmittingStudentAnswer ? 'Submitting...' : 'Submit Answer'}
              </button>
            </div>
          </div>
        ) : post.studentAnswer ? (
          <div className="answers-list">
            <div className={`answer-item ${post.studentAnswerEndorsed ? 'endorsed-answer' : ''}`}>
              {post.studentAnswerEndorsed && (
                <div className="endorsement-message">
                  ✓ This answer has been endorsed by your instructor
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
              <button 
                className="edit-answer-btn"
                onClick={handleStudentAnswerClick}
              >
                ✏️ Edit Answer
              </button>
            </div>
          </div>
        ) : (
          <div 
            className="empty-answer clickable"
            onClick={handleStudentAnswerClick}
          >
            Click to start off the wiki answer
          </div>
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
          aiReply={chatAiReply}
          onClose={() => setIsChatOpen(false)}
        />
      )}
    </div>
  );
};

export default PostView;