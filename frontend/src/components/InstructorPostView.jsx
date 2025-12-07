import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './InstructorPostView.css';

const API_BASE = 'http://localhost:8080';

const InstructorPostView = ({
  posts = [],
  pinnedPosts = [],
  selectedPost,
  loading,
  error,
  onPostClick,
  onFilterClick,
  selectedFilter,
  onInstructorReply,
  onEndorseReply,
  onEndorseStudentAnswer,
  onLikePost,
  onPostUpdated,
  onBack,
  onRefreshPost,
}) => {
  const [upvoted, setUpvoted] = useState(false);
  const [starred, setStarred] = useState(false);
  const [instructorReplyText, setInstructorReplyText] = useState('');
  const [followupText, setFollowupText] = useState('');

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  
  const [isEndorsingStudentAnswer, setIsEndorsingStudentAnswer] = useState(false);

  // CRITICAL FIX: Get current user from backend to properly check ownership
  const [currentUserEmail, setCurrentUserEmail] = useState(null);
  const [postAuthorEmail, setPostAuthorEmail] = useState(null);

  const allPosts = [...pinnedPosts, ...posts].filter(Boolean);
  const activePost =
    (selectedPost && selectedPost.id && selectedPost) ||
    allPosts[0] ||
    null;

  const post = activePost;

  // CRITICAL FIX: Fetch current user info for ownership check
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/accounts/me`, {
          withCredentials: true,
        });
        setCurrentUserEmail(res.data.email);
      } catch (err) {
        console.error('Failed to fetch current user:', err);
      }
    };
    fetchCurrentUser();
  }, []);

  // CRITICAL FIX: Fetch post author info for ownership check
  useEffect(() => {
    const fetchPostAuthor = async () => {
      if (!post || !post.id) return;
      
      try {
        const res = await axios.get(`${API_BASE}/api/posts/${post.id}`, {
          withCredentials: true,
        });
        
        if (res.data.account && res.data.account.email) {
          setPostAuthorEmail(res.data.account.email);
        }
      } catch (err) {
        console.error('Failed to fetch post author:', err);
      }
    };
    
    fetchPostAuthor();
    setEditTitle(post?.title || '');
    setEditContent(post?.content || '');
  }, [post?.id]);

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

  // CRITICAL FIX: Use email-based ownership check instead of display name
  const isMyPost = currentUserEmail && postAuthorEmail && 
    currentUserEmail.toLowerCase() === postAuthorEmail.toLowerCase();

  const handleUpvote = () => {
    if (onLikePost) {
      onLikePost(post.id);
    }
  };

  const handleStar = () => setStarred(prev => !prev);

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
        setIsEditing(false);
        
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

  const handleInstructorReplySubmit = async () => {
    if (!instructorReplyText.trim() || !onInstructorReply) return;

    try {
      await onInstructorReply(post.id, instructorReplyText, null);
      setInstructorReplyText('');
    } catch (err) {
      console.error(err);
    }
  };

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

  const handleEndorseStudentAnswer = async () => {
    setIsEndorsingStudentAnswer(true);
    try {
      await axios.put(
        `${API_BASE}/api/posts/${post.id}/student-answer/endorse`,
        {},
        { withCredentials: true }
      );
      
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

  const followups = post.followups || [];

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

  const getReplyDisplayType = (followup) => {
    if (followup.replacedByInstructor) {
      return 'instructor';
    }
    if ((followup.isLLMReply || followup.llmGenerated) && followup.instructorEdited) {
      return 'instructor-ai';
    }
    if ((followup.isLLMReply || followup.llmGenerated) && followup.endorsed && !followup.instructorEdited) {
      return 'ai-endorsed';
    }
    if (followup.isLLMReply || followup.llmGenerated) {
      return 'ai';
    }
    if (followup.fromInstructor) {
      return 'instructor';
    }
    return 'student';
  };

  const renderReplies = (nodes, depth = 0) =>
    nodes.map((followup) => {
      const displayType = getReplyDisplayType(followup);
      
      return (
      <div
        key={followup.id}
        className={`followup-item ${(followup.isLLMReply || followup.llmGenerated) ? 'ai-reply' : ''} ${followup.endorsed ? 'endorsed' : ''} ${followup.instructorEdited ? 'edited' : ''} ${followup.flagged ? 'flagged-reply' : ''} ${followup.replacedByInstructor ? 'instructor-answer' : ''} ${displayType === 'instructor-ai' ? 'instructor-ai-answer' : ''}`}
        style={{ marginLeft: depth * 24 }}
      >
        <div className="followup-meta">
          <span className="followup-author">
            {displayType === 'instructor' && `👨‍🏫 ${followup.editedByName || followup.author || 'Instructor'}`}
            {displayType === 'instructor-ai' && '🤖 Instructor-AI'}
            {displayType === 'ai-endorsed' && '🤖 AI Tutor'}
            {displayType === 'ai' && '🤖 AI Tutor'}
            {displayType === 'student' && followup.author}
          </span>
          
          {displayType === 'instructor' && followup.replacedByInstructor && (
            <span className="instructor-badge">Instructor Answer</span>
          )}
          
          {displayType === 'instructor-ai' && (
            <span className="instructor-ai-badge">
              ✏️ Edited by {followup.editedByName || 'Instructor'}
            </span>
          )}
          
          {displayType === 'ai-endorsed' && (
            <span className="endorsed-badge">✓ INSTRUCTOR APPROVED</span>
          )}
          
          {(followup.isLLMReply || followup.llmGenerated) && followup.flagged && !followup.endorsed && (
            <span className="flagged-badge">🚩 Flagged by Student</span>
          )}
          
          <span className="followup-time">
            {followup.editedAt || followup.time}
          </span>
        </div>

        <div className="followup-content">{followup.content}</div>

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

  const wasEdited = post.modifiedAt && post.createdAt && 
    new Date(post.modifiedAt).getTime() !== new Date(post.createdAt).getTime();

  return (
    <div className="instructor-post-view">
      <div className="post-header">
        <div className="post-header-left">
          {onBack && (
            <button className="back-btn" onClick={onBack}>
              ←
            </button>
          )}
          <div className="post-number">
            <span className="question-icon">?</span>
            <span className="post-type">{post.type}</span>
            <span className="post-id">@{post.number}</span>
          </div>
          <button className="more-options">⋮</button>
        </div>
      </div>

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
          <h1 className="post-title">{post.title}</h1>

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

          <div className="post-body">{post.content}</div>

          {post.tags && post.tags.length > 0 && (
            <div className="post-tags">
              {post.tags.map((tag, index) => (
                <span key={index} className="post-tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

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
          </div>

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
    </div>
  );
};

export default InstructorPostView;