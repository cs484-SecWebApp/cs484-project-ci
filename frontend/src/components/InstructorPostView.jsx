import React, { useState } from 'react';
import './InstructorPostView.css';

const InstructorPostView = ({
  post,
  currentUser,
  onBack,
  onLLMReply,
  onInstructorReply,
  onEndorse,
}) => {
  const [upvoted, setUpvoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [instructorReplyText, setInstructorReplyText] = useState('');
  const [followupText, setFollowupText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  const handleUpvote = () => {
    setUpvoted(!upvoted);
  };

  const handleStar = () => {
    setStarred(!starred);
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
      await onLLMReply(post.id);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAILoading(false);
    }
  };

  const handleInstructorReplySubmit = async () => {
    if (!instructorReplyText.trim()) return;
    
    try {
      await onInstructorReply(post.id, instructorReplyText);
      setInstructorReplyText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleFollowupSubmit = async () => {
    if (!followupText.trim()) return;
    
    try {
      await onInstructorReply(post.id, followupText);
      setFollowupText('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleEndorseClick = (replyId) => {
    onEndorse(post.id, replyId);
  };

  return (
    <div className="instructor-post-view">
      {/* Breadcrumb Navigation */}
      <div className="post-nav">
        <button className="back-btn" onClick={onBack}>←</button>
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
        <span className="post-updated">Updated {post.updatedAt} by {post.author}</span>
      </div>

      {/* Post Content */}
      <div className="post-body">
        {post.content}
      </div>

      {/* Post Tags */}
      {post.tags && post.tags.length > 0 && (
        <div className="post-tags">
          {post.tags.map((tag, index) => (
            <span key={index} className="post-tag">{tag}</span>
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
          <span className="thumbs-up-icon">👍</span> {post.upvotes + (upvoted ? 1 : 0)}
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
                    className={`endorse-btn ${reply.endorsed ? 'endorsed' : ''}`}
                    onClick={() => handleEndorseClick(reply.id)}
                  >
                    {reply.endorsed ? '✓ Endorsed by Instructor' : 'Endorse'}
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
          Updated {post.instructorReplies && post.instructorReplies.length > 0
            ? post.instructorReplies[post.instructorReplies.length - 1].time 
            : 'never'} by {post.instructorReplies && post.instructorReplies.length > 0
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
              <button className="submit-answer-btn" onClick={handleInstructorReplySubmit}>
                Post Instructor Answer
              </button>
            )}
          </div>
        )}
      </div>

      {/* AI Answer Section - Only show if there are AI replies */}
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
                  <span className="answer-author">Unknown</span>
                  <span className="answer-time">{reply.time}</span>
                </div>
                <div className="answer-content">{reply.content}</div>
                <div className="answer-actions">
                  <button 
                    className={`endorse-btn ${reply.endorsed ? 'endorsed' : ''}`}
                    onClick={() => handleEndorseClick(reply.id)}
                  >
                    {reply.endorsed ? '✓ Endorsed by Instructor' : 'Endorse'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Followup Discussions Section */}
      <div className="followup-section">
        <div className="section-header followup-header">
          <div className="section-icon followup-icon">💬</div>
          <h2 className="section-title">
            {post.followupDiscussions?.length || 0} Followup Discussion{(post.followupDiscussions?.length || 0) !== 1 ? 's' : ''}
          </h2>        
        </div>
        
        {post.followupDiscussions && post.followupDiscussions.length > 0 ? (
          <div className="followups-list">
            {post.followupDiscussions.map((followup, index) => (
              <div key={index} className="followup-item">
                <div className="followup-meta">
                  <span className="followup-author">{followup.author}</span>
                  <span className="followup-time">{followup.time}</span>
                </div>
                <div className="followup-content">{followup.content}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-followups">No followup discussions yet</div>
        )}

        <div className="new-followup">
          <textarea
            className="followup-input"
            placeholder="Compose a new followup discussion"
            value={followupText}
            onChange={(e) => setFollowupText(e.target.value)}
          />
          {followupText && (
            <button className="submit-followup-btn" onClick={handleFollowupSubmit}>
              Post Followup
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default InstructorPostView;