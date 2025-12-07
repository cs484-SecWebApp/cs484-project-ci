import React, { useState, useEffect } from 'react';
import axios from 'axios';
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
  onFlagAIResponse,
  onStudentAnswerSubmit,
  onRefreshPost,
  onLikeUpdated,
  onPostUpdated,
}) => {
  // CRITICAL FIX: Use useEffect to sync state when post changes
  const [upvoted, setUpvoted] = useState(post.currentUserLiked || false);
  const [upvoteCount, setUpvoteCount] = useState(post.upvotes || 0);
  const [followupText, setFollowupText] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);

  const [replyingToId, setReplyingToId] = useState(null);
  const [replyingToAuthor, setReplyingToAuthor] = useState(null);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatAiReply, setChatAiReply] = useState(null);

  const [isEditingStudentAnswer, setIsEditingStudentAnswer] = useState(false);
  const [studentAnswerText, setStudentAnswerText] = useState(post.studentAnswer || '');
  const [isSubmittingStudentAnswer, setIsSubmittingStudentAnswer] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(post.title);
  const [editContent, setEditContent] = useState(post.content);
  const [isSaving, setIsSaving] = useState(false);

  // CRITICAL FIX: Reset like state when post changes
  useEffect(() => {
    setUpvoted(post.currentUserLiked || false);
    setUpvoteCount(post.upvotes || 0);
    setEditTitle(post.title);
    setEditContent(post.content);
    setStudentAnswerText(post.studentAnswer || '');
  }, [post.id]); // Re-run when post ID changes

  // CRITICAL FIX: More robust ownership check
  const isMyPost = post.author && currentUser && 
    post.author.trim().toLowerCase() === currentUser.trim().toLowerCase();
  
  const followups = post.followups || [];
  
  // FIXED: First instructor response goes to Instructor's Answer section
  // Priority: 1) Formal instructor answer (isInstructorAnswer: true)
  //           2) First instructor reply (fromInstructor: true) if no formal answer exists
  //           3) Replaced AI responses (replacedByInstructor: true)
  const formalInstructorAnswer = followups.find(f => f.isInstructorAnswer === true);
  const firstInstructorReply = followups.find(f => f.fromInstructor && !f.isLLMReply);
  const replacedAIResponses = followups.filter(f => f.replacedByInstructor);
  
  // Build instructor answers array
  let instructorAnswers = [...replacedAIResponses];
  if (formalInstructorAnswer) {
    instructorAnswers = [formalInstructorAnswer, ...instructorAnswers];
  } else if (firstInstructorReply) {
    instructorAnswers = [firstInstructorReply, ...instructorAnswers];
  }
  
  // Get the ID of the reply shown in Instructor's Answer section (to exclude from followups)
  const instructorAnswerReplyId = (formalInstructorAnswer || firstInstructorReply)?.id;
  
  // All other replies go to Followup Discussions
  const allFollowups = followups.filter(f => 
    f.id !== instructorAnswerReplyId && !f.replacedByInstructor
  );

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

  // Build reply tree from all followups (including instructor followup replies)
  const replyTree = buildReplyingTo(allFollowups);

  const getReplyDisplayType = (followup) => {
    const isAIResponse = followup.isLLMReply || followup.llmGenerated;
    
    // Formal instructor answer (replaced AI or submitted in answer box)
    if (followup.replacedByInstructor || followup.isInstructorAnswer) {
      return 'instructor';
    }
    // AI response edited by instructor
    if (isAIResponse && followup.instructorEdited) {
      return 'instructor-ai';
    }
    // AI response endorsed by instructor
    if (isAIResponse && followup.endorsed && !followup.instructorEdited) {
      return 'ai-endorsed';
    }
    // Regular AI response
    if (isAIResponse) {
      return 'ai';
    }
    // Instructor followup reply (NOT in answer box)
    if (followup.fromInstructor) {
      return 'instructor-followup';
    }
    // Student reply
    return 'student';
  };

  const renderReplies = (nodes, depth = 0) =>
    nodes.map((followup) => {
      const displayType = getReplyDisplayType(followup);
      
      return (
      <div
        key={followup.id}
        className={`followup-item ${followup.isLLMReply ? 'ai-reply' : ''} ${followup.endorsed ? 'endorsed' : ''} ${followup.instructorEdited ? 'edited' : ''} ${followup.flagged ? 'flagged-reply' : ''} ${followup.replacedByInstructor ? 'instructor-answer' : ''} ${displayType === 'instructor-ai' ? 'instructor-ai-answer' : ''} ${displayType === 'instructor-followup' ? 'instructor-followup-reply' : ''}`}
        style={{ marginLeft: depth * 24 }}
      >
        <div className="followup-meta">
          <span className="followup-author">
            {displayType === 'instructor' && `👨‍🏫 ${followup.editedByName || followup.author || 'Instructor'}`}
            {displayType === 'instructor-ai' && '🤖 Instructor-AI'}
            {displayType === 'ai-endorsed' && '🤖 AI Tutor'}
            {displayType === 'ai' && '🤖 AI Tutor'}
            {displayType === 'instructor-followup' && `👨‍🏫 ${followup.author}`}
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

          {displayType === 'instructor-followup' && (
            <span className="instructor-followup-badge">Instructor</span>
          )}
          
          {/* ADDED: Show endorsed badge for student replies */}
          {displayType === 'student' && followup.endorsed && (
            <span className="endorsed-badge">✓ Endorsed by Instructor</span>
          )}
          
          {followup.isLLMReply && followup.flagged && !followup.endorsed && (
            <span className="flagged-badge">🚩 Under Review</span>
          )}
          
          <span className="followup-time">
            {followup.editedAt ? `${followup.editedAt}` : followup.time}
          </span>
        </div>

        <div className="followup-content">{followup.content}</div>

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
              displayType === 'instructor-followup' ? followup.author :
              displayType.startsWith('ai') ? 'AI Tutor' : followup.author
            );
          }}
        >
          Reply
        </button>

        {followup.isLLMReply && !followup.replacedByInstructor && (
          <>
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

  const wasEdited = post.modifiedAt && post.createdAt && 
    new Date(post.modifiedAt).getTime() !== new Date(post.createdAt).getTime();

return (
    <div className="post-view">
      <div className="post-header">
        <div className="post-header-left">
          <button className="back-btn" onClick={onBack}>
            ←
          </button>
          <div className="post-number">
            <span className="question-icon">?</span>
            <span className="post-type">{post.type}</span>
            <span className="post-id">@{post.number}</span>
          </div>
          {/* POST ENDORSEMENT BADGE */}
          {post.endorsed && (
            <span className="post-endorsed-badge">
              ✓ Good Question
              {post.endorsedBy && ` • Endorsed by ${post.endorsedBy}`}
            </span>
          )}
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

          <div
            className="post-body"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

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
              {upvoteCount}
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
                  placeholder="Write your answer here..."
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

          {/* Instructor Section - Shows only formal instructor answers */}
          <div className="answer-section instructor-answer-section">
            <div className="section-header">
              <div className="section-icon instructor-icon">I</div>
              <h2 className="section-title">Instructors' Answer</h2>
            </div>
            <div className="section-subtitle">
              Updated{' '}
              {instructorAnswers.length > 0
                ? instructorAnswers[instructorAnswers.length - 1].time
                : post.instructorReplies && post.instructorReplies.length > 0
                ? post.instructorReplies[post.instructorReplies.length - 1].time
                : 'never'}{' '}
              by{' '}
              {instructorAnswers.length > 0
                ? instructorAnswers[instructorAnswers.length - 1].author
                : post.instructorReplies && post.instructorReplies.length > 0
                ? post.instructorReplies[post.instructorReplies.length - 1].author
                : 'instructor'}
            </div>

            {/* Show formal instructor answers only */}
            {instructorAnswers.length > 0 ? (
              <div className="answers-list">
                {instructorAnswers.map((reply, index) => (
                  <div key={reply.id || index} className="answer-item">
                    <div className="answer-meta">
                      <span className="answer-author">
                        {reply.replacedByInstructor 
                          ? `👨‍🏫 ${reply.editedByName || reply.author || 'Instructor'}`
                          : `👨‍🏫 ${reply.author || 'Instructor'}`
                        }
                      </span>
                      <span className="answer-time">{reply.editedAt || reply.time}</span>
                    </div>
                    <div className="answer-content">{reply.content}</div>
                  </div>
                ))}
              </div>
            ) : post.instructorReplies && post.instructorReplies.length > 0 ? (
              <div className="answers-list">
                {post.instructorReplies.map((reply, index) => (
                  <div key={reply.id || index} className="answer-item">
                    <div className="answer-meta">
                      <span className="answer-author">{reply.author || 'Instructor'}</span>
                      <span className="answer-time">{reply.time}</span>
                    </div>
                    <div className="answer-content">{reply.content}</div>
                  </div>
                ))}
              </div>
            ) : post.instructorAnswer ? (
              <div className="answers-list">
                <div className="answer-item">
                  <div className="answer-content">{post.instructorAnswer}</div>
                </div>
              </div>
            ) : (
              <div className="empty-answer">No instructor answer yet</div>
            )}
          </div>

          {/* AI Section */}
          {(post.aiReplies?.length > 0 || post.aiAnswer) && (
            <div className="answer-section ai-answer-section">
              <div className="section-header">
                <div className="section-icon ai-icon-section">🤖</div>
                <h2 className="section-title">AI-Generated Answer</h2>
              </div>
              <div className="section-subtitle">
                Generated by Gemini AI assistant
              </div>

              <div className="answers-list">
                {post.aiReplies && post.aiReplies.length > 0 ? (
                  post.aiReplies.map((reply, index) => (
                    <div key={reply.id || index} className="answer-item ai-answer">
                      <div className="answer-meta">
                        <span className="answer-author">AI Tutor</span>
                        <span className="answer-time">{reply.time}</span>
                      </div>
                      <div className="answer-content">{reply.content}</div>
                      {reply.endorsed && (
                        <div className="endorsement-message">
                          ✓ This AI response has been verified by your instructor
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="answer-item ai-answer">
                    <div className="answer-content">{post.aiAnswer}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Followup Discussions - Now includes instructor followup replies */}
          <div className="followup-section">
            <div className="section-header followup-header">
              <div className="section-icon followup-icon">💬</div>
              <h2 className="section-title">
                {allFollowups.length} Followup Discussion{allFollowups.length !== 1 ? 's' : ''}
              </h2>
            </div>

            {allFollowups.length > 0 ? (
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