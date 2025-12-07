import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudentDashboard.css';
import PostView from './PostView';
import NewPostView from './NewPostView';
import ResourcesPage from './ResourcesPage';
import JoinClassModel from './JoinClassModel';
import UserDropdown from './UserDropDown';
import AccountSettings from './AccountSettings';
import './WelcomeSection.css';

const API_BASE = 'http://localhost:8080';

// Helper function to strip HTML tags from text for preview
const stripHtmlTags = (html) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
};

const StudentDashboard = ({ onLogout, userName }) => {
const normalizePosts = (apiPosts) =>
  apiPosts.map((p) => {
    // Author comes from PostSummary
    const author =
      (p.authorFirstName || p.authorLastName)
        ? `${p.authorFirstName || ''} ${p.authorLastName || ''}`.trim()
        : 'Unknown';

    // ADDED: Check if post is from instructor
    const isInstructorPost = p.account && p.account.authorities
      ? p.account.authorities.some((auth) => 
          auth.name === 'ROLE_ADMIN' || auth.name === 'ROLE_INSTRUCTOR'
        )
      : false;

    const created = p.createdAt ? new Date(p.createdAt) : null;
    const modified = p.modifiedAt ? new Date(p.modifiedAt) : null;

  
    const followups = (p.replies || []).map((r) => {
      const isLLMReply = Boolean(r.llmGenerated);

      // Debug: log instructor replies
      if (r.fromInstructor || r.author?.firstName === 'admin' || r.author?.lastName === 'admin') {
        console.log('=== INSTRUCTOR REPLY DEBUG ===');
        console.log('Reply ID:', r.id);
        console.log('fromInstructor:', r.fromInstructor);
        console.log('isInstructorAnswer:', r.isInstructorAnswer);
        console.log('author:', r.author);
        console.log('authorName:', r.authorName);
        console.log('replacedByInstructor:', r.replacedByInstructor);
      }

        // Determine author name based on reply state
        let authorName;
        let displayAsAI = isLLMReply;
        
        if (r.replacedByInstructor) {
          // Instructor completely replaced - show as instructor answer
          const editorName = r.editedByName || 
            (r.editedBy ? `${r.editedBy.firstName || ''} ${r.editedBy.lastName || ''}`.trim() : null);
          authorName = editorName || 'Instructor';
          displayAsAI = false; // No longer show as AI
        } else if (r.instructorEdited && isLLMReply) {
          // AI response edited by instructor - still show as AI but note edit
          authorName = 'AI Tutor';
          displayAsAI = true;
        } else if (isLLMReply) {
          authorName = 'AI Tutor';
        } else if (r.author) {
          authorName = `${r.author.firstName || ''} ${r.author.lastName || ''}`.trim();
        } else if (r.authorName) {
          authorName = r.authorName;
        } else {
          authorName = 'Unknown';
        }

        return {
          id: r.id,
          author: authorName,
          parentReplyId: r.parentReplyId ?? null,
          isLLMReply: displayAsAI,
          llmGenerated: r.llmGenerated,
          fromInstructor: r.fromInstructor || false,
          isInstructorAnswer: r.isInstructorAnswer || r.replacedByInstructor || false, // NEW FIELD
          endorsed: r.endorsed || false,
          flagged: r.flagged || false,
          reviewed: r.reviewed || false,
          instructorEdited: r.instructorEdited || false,
          replacedByInstructor: r.replacedByInstructor || false,
          editedByName: r.editedByName || 
            (r.editedBy ? `${r.editedBy.firstName || ''} ${r.editedBy.lastName || ''}`.trim() : null),
          editedAt: r.editedAt ? new Date(r.editedAt).toLocaleString() : null,
          flagReason: r.flagReason || null,
          time: r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
          content: r.body,
        };
      });

    return {
      id: p.id,
      number: p.id,
      type: 'question',
      title: p.title,
      preview: p.body ? stripHtmlTags(p.body).slice(0, 120) : '',
      content: p.body,
      time: created
        ? created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '',
      updatedAt: created
        ? created.toLocaleDateString()
        : '',
      createdAt: p.createdAt,
      modifiedAt: p.modifiedAt,
      author,
      isInstructorPost, // ADDED: Include instructor post flag
      tag: 'general',
      tags: ['general'],
      isPinned: false,
      isUnread: false,
      upvotes: p.upVotes || 0, 
      currentUserLiked: p.currentUserLiked || false, 
      views: 0,
      aiAnswer: null,
      // Student Answer (wiki-style) fields from API
      studentAnswer: p.studentAnswer || null,
      studentAnswerEndorsed: p.studentAnswerEndorsed || false,
      studentAnswerAuthor: p.studentAnswerAuthorName || null,
      studentAnswerUpdatedAt: p.studentAnswerUpdatedAt 
        ? new Date(p.studentAnswerUpdatedAt).toLocaleString() 
        : null,
      studentAnswerEndorsedBy: p.studentAnswerEndorsedByName || null,
      // POST ENDORSEMENT fields from API
      endorsed: p.endorsed || false,
      endorsedBy: p.endorsedByName || null,
      endorsedAt: p.endorsedAt
        ? new Date(p.endorsedAt).toLocaleString()
        : null,
      instructorAnswer: null,
      followups,
    };
  });


  // ----- classes -----
  const [courses, setCourses] = useState([]);
  const [activeCourse, setActiveCourse] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseError, setCourseError] = useState(null);

  // ----- posts / UI state -----
  const [selectedTab, setSelectedTab] = useState('qa');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [createdPost, setCreatedPost] = useState(false);
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showJoinClassModel, setShowJoinClassModel] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isInstructor, setIsInstructor] = useState(false);

  // ----- Flag Modal State -----
  const [showFlagModal, setShowFlagModal] = useState(false);
  const [flaggingReplyId, setFlaggingReplyId] = useState(null);
  const [flaggingPostId, setFlaggingPostId] = useState(null);
  const [flagReason, setFlagReason] = useState('');
  const [flagLoading, setFlagLoading] = useState(false);
  const handleLikeUpdated = (postId, liked, likeCount) => {
  setPosts(prevPosts => 
    prevPosts.map(p => 
      p.id === postId 
        ? { ...p, currentUserLiked: liked, upvotes: likeCount }
        : p
    )
  );
  

  if (selectedPost && selectedPost.id === postId) {
    setSelectedPost(prev => ({
      ...prev,
      currentUserLiked: liked,
      upvotes: likeCount
    }));
  }
};

  const handlePostUpdated = (updatedPostData) => {
    // Normalize the updated post
    const normalizedPost = normalizePosts([updatedPostData])[0];
    
    // Update posts array
    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === normalizedPost.id ? normalizedPost : p
      )
    );
    
    // Update selected post
    if (selectedPost && selectedPost.id === normalizedPost.id) {
      setSelectedPost(normalizedPost);
    }
  };

  // ---------- load enrolled classes ----------
  const loadCourses = async () => {
    try {
      setCoursesLoading(true);
      setCourseError(null);

      const res = await axios.get(`${API_BASE}/api/classes/mine`, {
        withCredentials: true,
      });

      const list = res.data || [];
      setCourses(list);


      if (list.length > 0 && !activeCourse) {
        setActiveCourse(list[0]);       // pick first enrolled course
      }
    } catch (err) {
      console.error(err);
      setCourseError('Error fetching your classes');
    } finally {
      setCoursesLoading(false);
    }
  };

  useEffect(() => {
  const fetchMe = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/accounts/me`, {
        withCredentials: true,
      });

      const me = res.data;
      const roles = me.roles || [];

      const instructorLike =
        roles.includes('ROLE_ADMIN') || roles.includes('ROLE_INSTRUCTOR');

      setIsInstructor(instructorLike);
    } catch (err) {
      console.error('Failed to fetch current account', err);
      setIsInstructor(false);
    }
  };

  fetchMe();
}, []);

  useEffect(() => {
    loadCourses();
  }, []);


  useEffect(() => {
    const fetchPostsForCourse = async () => {
      if (!activeCourse) {
        setPosts([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const response = await axios.get(
          `${API_BASE}/api/posts/classes/${activeCourse.id}`,
          { withCredentials: true }
        );

        const normalizedPosts = normalizePosts(response.data);
        setPosts(normalizedPosts);
      } catch (err) {
        console.error(err);
        setError('Error fetching posts for this class');
      } finally {
        setLoading(false);
      }
    };

    fetchPostsForCourse();
  }, [activeCourse]); 


  const refetchPostsForActiveCourse = async () => {
    if (!activeCourse) return;

    const res = await axios.get(
      `${API_BASE}/api/posts/classes/${activeCourse.id}`,
      { withCredentials: true }
    );
    const normalized = normalizePosts(res.data);
    setPosts(normalized);
    return normalized;
  };

  const handleLLMReply = async (postId, text) => {
    if (!activeCourse) return;
    try {
      await axios.post(
        `${API_BASE}/api/posts/${postId}/LLMReply`,
        { body: text },
        { withCredentials: true }
      );

      const normalized = await refetchPostsForActiveCourse();
      const updatedPost = normalized.find((p) => p.id === postId);
      if (updatedPost) setSelectedPost(updatedPost);
    } catch (err) {
      console.error(err);
      setError('Error throwing LLM reply');
    }
  };

  const handleFollowupSubmit = async (postId, text, parentReplyId = null) => {
    if (!activeCourse) return;
    try {
      await axios.post(
        `${API_BASE}/api/posts/${postId}/replies`,
        { body: text, parentReplyId, isInstructorAnswer: false }, // Students never submit instructor answers
        { withCredentials: true }
      );

      const normalized = await refetchPostsForActiveCourse();
      const updatedPost = normalized.find((p) => p.id === postId);
      if (updatedPost) setSelectedPost(updatedPost);
    } catch (err) {
      console.error(err);
      setError('Error saving followup');
    }
  };

  const handleNewPostSubmit = async (title, body) => {
    if (!activeCourse) {
      setError('Please select a class before posting.');
      return;
    }

    try {
      // create post for the active course
      const response = await axios.post(
        `${API_BASE}/api/posts/classes/${activeCourse.id}`,
        { title, body },
        { withCredentials: true }
      );

      const newPost = normalizePosts([response.data])[0];

      // prepend new post locally
      setPosts((prev) => [newPost, ...prev]);
      setSelectedPost(newPost);
      setCreatedPost(false);
      setShowWelcome(false);
    } catch (err) {
      console.error(err);
      setError('Error posting new question');
    }
  };

  // ---------- Flag AI Response Handler ----------
  const openFlagModal = (postId, replyId) => {
    setFlaggingPostId(postId);
    setFlaggingReplyId(replyId);
    setFlagReason('');
    setShowFlagModal(true);
  };

  const closeFlagModal = () => {
    setShowFlagModal(false);
    setFlaggingPostId(null);
    setFlaggingReplyId(null);
    setFlagReason('');
  };

  const handleFlagAIResponse = async () => {
    if (!flaggingPostId || !flaggingReplyId) return;

    try {
      setFlagLoading(true);
      await axios.put(
        `${API_BASE}/api/posts/${flaggingPostId}/replies/${flaggingReplyId}/flag`,
        { reason: flagReason },
        { withCredentials: true }
      );

      // Refresh posts to show updated flag status
      const normalized = await refetchPostsForActiveCourse();
      const updatedPost = normalized.find((p) => p.id === flaggingPostId);
      if (updatedPost) setSelectedPost(updatedPost);

      closeFlagModal();
    } catch (err) {
      console.error('Error flagging response:', err);
      alert('Failed to flag response. Please try again.');
    } finally {
      setFlagLoading(false);
    }
  };

  // ----- fake stats -----
  const stats = {
    allCaughtUp: true,
    unreadPosts: 0,
    unansweredQuestions: 2,
    unansweredFollowups: 5,
    totalPosts: 93,
    totalContributions: 214,
    studentsEnrolled: 76,
    instructorEngagement: 51,
    instructorResponses: 51,
    studentParticipation: 8,
    studentResponses: 8,
  };

  // ----- UI handlers -----
  const handleNewPost = () => {
    setCreatedPost(true);
    setShowWelcome(false);
  };

  const handlePostClick = (postId) => {
    const post = posts.find((p) => p.id === postId);
    setSelectedPost(post);
    setShowWelcome(false);
  };

  const handleLogoClick = () => {
    setSelectedPost(null);
    setCreatedPost(false);
    setShowWelcome(true);
    setSelectedTab('qa');  // ADDED: Switch to Q&A tab when clicking logo
  };

  const handleCourseSelect = (course) => {
    setActiveCourse(course);
    setShowCourseDropdown(false);
    setSelectedPost(null);
  };

  const toggleCourseDropdown = () => {
    setShowCourseDropdown(!showCourseDropdown);
  };

  const handleJoinAnotherClass = () => {
    setShowCourseDropdown(false);
    setShowJoinClassModel(true);
  };

  const handleAccountSettings = () => {
    setShowAccountSettings(true);
  };

  const handleLogout = () => {
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/login';
    }
  };

  const handleJoinClassSubmit = async (joinCode) => {
    try {
      await axios.post(
        `${API_BASE}/api/classes/join-by-code`,
        { code: joinCode },
        { withCredentials: true }
      );
      await loadCourses();
      setShowJoinClassModel(false);
    } catch (err) {
      console.error(err);
      throw err;
    }
  };

  const filteredPosts = posts.filter((post) => {
    const matchesSearch =
      !searchQuery ||
      post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (post.preview &&
        post.preview.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  const pinnedPosts = filteredPosts.filter((p) => p.isPinned);
  const regularPosts = filteredPosts.filter((p) => !p.isPinned);

  // ===========================
  // RENDER
  // ===========================
  return (
    <div className="student-dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <span
            className="logo"
            onClick={handleLogoClick}
            style={{ cursor: 'pointer' }}
          >
            classGPT
          </span>
          <div className="course-dropdown-container">
            <div className="course-dropdown" onClick={toggleCourseDropdown}>
              {activeCourse
                ? `${activeCourse.code}: ${activeCourse.name}`
                : 'Select a class'}
              <span className="dropdown-icon">▼</span>
            </div>
            {showCourseDropdown && (
              <div className="course-dropdown-menu">
                <div className="course-list">
                  {courses.map((course) => (
                    <div
                      key={course.id}
                      className={`course-item ${
                        activeCourse?.id === course.id ? 'active' : ''
                      }`}
                      onClick={() => handleCourseSelect(course)}
                    >
                      <div className="course-info">
                        <div className="course-code">{course.code}: {course.name}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="dropdown-divider" />
                <button className="join-class-btn" onClick={handleJoinAnotherClass}>
                  + Join Another Class
                </button>
              </div>
            )}
          </div>
        </div>
        <div className="header-center">
          <nav className="nav-tabs">
            <button
              className={selectedTab === 'qa' ? 'active' : ''}
              onClick={() => setSelectedTab('qa')}
            >
              Q&A
            </button>
            <button
              className={selectedTab === 'resources' ? 'active' : ''}
              onClick={() => setSelectedTab('resources')}
            >
              Resources
            </button>
          </nav>
        </div>
        <div className="header-right">
          <div className="user-info">
            <button 
              className="user-avatar"
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              {userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase() : '?'}
            </button>
            <UserDropdown
              isOpen={showUserDropdown}
              onClose={() => setShowUserDropdown(false)}
              userName={userName}
              onAccountSettings={handleAccountSettings}
              onLogout={handleLogout}
              onJoinClass={handleJoinAnotherClass}
            />
          </div>
        </div>
      </header>

      {/* AccountSettings Modal */}
      {showAccountSettings && (
        <AccountSettings onClose={() => setShowAccountSettings(false)} />
      )}

      {/* Body */}
      <div className="dashboard-content">
        {/* Sidebar */}
        {selectedTab === 'qa' && (
          <aside className="sidebar">
            <button className="new-post-btn" onClick={handleNewPost}>
              <span className="plus-icon">+</span> New Post
            </button>
            <div className="search-box">
              <input
                type="text"
                placeholder="Search or add a post..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="posts-section">
              {pinnedPosts.length > 0 && (
                <div className="pinned-section">
                  <div className="section-header">
                    <span>📌</span>
                    <span>Pinned</span>
                  </div>
                  {pinnedPosts.map((post) => (
                    <div
                      key={post.id}
                      className={`post-item ${post.isUnread ? 'unread' : ''}`}
                      onClick={() => handlePostClick(post.id)}
                    >
                      <div className="post-info">
                        <div className="post-title">{post.title}</div>
                        {post.preview && (
                          <div className="post-preview">{post.preview}</div>
                        )}
                      </div>
                      <div className="post-meta">{post.time}</div>
                    </div>
                  ))}
                </div>
              )}

              <div className="section-header">
                <span>▼</span>
                <span>{searchQuery ? 'Search Results' : 'Today'}</span>
              </div>
              {loading ? (
                <div className="posts-list-empty">
                  <div className="empty-icon">⏳</div>
                  <div>Loading posts…</div>
                </div>
              ) : error ? (
                <div className="posts-list-empty">
                  <div className="empty-icon">⚠️</div>
                  <div>{error}</div>
                </div>
              ) : regularPosts.length === 0 && pinnedPosts.length === 0 ? (
                <div className="posts-list-empty">
                  <div className="empty-icon">📝</div>
                  <div>
                    {searchQuery 
                      ? `No posts found matching "${searchQuery}"` 
                      : 'No posts yet in this class.'}
                    </div>
                    {!searchQuery && (
                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#aaa' }}>
                        Click "New Post" to start a discussion!
                      </div>
                    )}
                    {searchQuery && (
                      <button 
                        onClick={() => setSearchQuery('')}
                        style={{
                          marginTop: '12px',
                          padding: '6px 12px',
                          background: '#3b82f6',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Clear Search
                      </button>
                    )}
                  </div>
                ) : (
                  regularPosts.map((post) => (
                    <div
                      key={post.id}
                      className={`post-item ${
                        post.isUnread ? 'unread' : ''
                      } ${post.isInstructorPost ? 'instructor-post' : ''} ${post.endorsed ? 'endorsed-post' : ''}`}
                      onClick={() => handlePostClick(post.id)}
                    >
                      <div className="post-content">
                        <div className="post-title-row">
                          {post.isInstructorPost && (
                            <span className="instructor-post-badge" title="Posted by instructor">👨‍🏫</span>
                          )}
                          {post.endorsed && (
                            <span className="endorsed-post-badge" title="Good question - endorsed by instructor">⭐</span>
                          )}
                          <div className="post-title">{post.title}</div>
                          {(post.studentAnswerEndorsed || 
                            post.followups?.some(f => f.endorsed || f.replacedByInstructor)) && (
                            <span className="endorsed-indicator" title="Has endorsed answer">✓</span>
                          )}
                        </div>
                        <div className="post-preview">{post.preview}</div>
                      </div>
                      <div className="post-meta">
                        <div className="post-time">{post.time}</div>
                        {post.isUnread && (
                          <div className="unread-badge">📋</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className={`main-content ${selectedTab !== 'qa' ? 'full-width' : ''}`}>
          {selectedTab === 'resources' ? (
            <ResourcesPage activeCourse={activeCourse} isInstructor={isInstructor}/>
          ) : createdPost ? (
            <NewPostView
              onCancel={() => setCreatedPost(false)}
              onPostCreated={async (post) => {
                setCreatedPost(false);
                setSelectedPost(post);
                setShowWelcome(false);
              }}
              onSubmit={handleNewPostSubmit}
            />
          ) : showWelcome || (!selectedPost && posts.length === 0) ? (
            /* Welcome / Getting Started Section for Students */
            <div className="welcome-section">
              <div className="welcome-header">
                <h2 className="welcome-title">
                  <span className="wave-emoji">👋</span>
                  Welcome to classGPT!
                </h2>
                <p className="welcome-subtitle">
                  Your collaborative Q&A platform for class discussions. Here's how to get started:
                </p>
              </div>

              <div className="instructions-grid">
                {/* Join a Class */}
                <div className="instruction-card">
                  <div className="instruction-icon blue">🎓</div>
                  <h3 className="instruction-title">Join a Class</h3>
                  <p className="instruction-description">
                    Get your class join code from your instructor and start participating.
                  </p>
                  <ol className="instruction-steps numbered">
                    <li>Click your profile icon (top right)</li>
                    <li>Select "Join Another Class"</li>
                    <li>Enter the 6-character join code</li>
                    <li>You're in! Start exploring</li>
                  </ol>
                  <button className="instruction-action" onClick={() => setShowJoinClassModel(true)}>
                    Join a Class <span className="arrow">→</span>
                  </button>
                </div>

                {/* Ask a Question */}
                <div className="instruction-card">
                  <div className="instruction-icon green">❓</div>
                  <h3 className="instruction-title">Ask a Question</h3>
                  <p className="instruction-description">
                    Post your questions and get help from classmates and instructors.
                  </p>
                  <ol className="instruction-steps numbered">
                    <li>Click the blue "New Post" button</li>
                    <li>Write a clear, descriptive title</li>
                    <li>Add details in the body (code, context)</li>
                    <li>Submit and wait for responses</li>
                  </ol>
                  <button className="instruction-action" onClick={handleNewPost}>
                    Ask a Question <span className="arrow">→</span>
                  </button>
                </div>

                {/* Use AI Help */}
                <div className="instruction-card">
                  <div className="instruction-icon purple">🤖</div>
                  <h3 className="instruction-title">Get AI Assistance</h3>
                  <p className="instruction-description">
                    Get instant help from our AI tutor, reviewed by instructors.
                  </p>
                  <ul className="instruction-steps">
                    <li>Click the "🤖 AI" button on any post</li>
                    <li>Get instant, contextual help</li>
                    <li>AI responses are reviewed by instructors</li>
                    <li>Flag responses if something seems wrong</li>
                  </ul>
                </div>

                {/* Contribute */}
                <div className="instruction-card">
                  <div className="instruction-icon orange">🤝</div>
                  <h3 className="instruction-title">Help Your Classmates</h3>
                  <p className="instruction-description">
                    Share your knowledge and earn recognition from instructors.
                  </p>
                  <ul className="instruction-steps">
                    <li>Answer questions you understand</li>
                    <li>Edit the wiki-style student answer</li>
                    <li>Get endorsements from instructors</li>
                    <li>Build your reputation</li>
                  </ul>
                </div>
              </div>

              {/* AI Note */}
              <div className="ai-note-section">
                <div className="ai-note-card">
                  <div className="ai-note-icon">💡</div>
                  <div className="ai-note-content">
                    <strong>Note about AI Responses:</strong> While the AI tutor may sometimes struggle to reference specific documents by name, rest assured it is always indexing and learning from your class resources to provide contextually relevant answers.
                  </div>
                </div>
              </div>
            </div>
          ) : selectedPost ? (
            <PostView
              post={selectedPost}
              currentUser={userName || 'User'}
              courseId={activeCourse.id}
              onBack={() => setSelectedPost(null)}
              onLLMReply={handleLLMReply}
              onFollowupSubmit={handleFollowupSubmit}
              onFlagAIResponse={openFlagModal}
              onLikeUpdated={handleLikeUpdated}
              onPostUpdated={handlePostUpdated}
              onRefreshPost={async () => {
                // Refresh posts to get updated student answer
                try {
                  const response = await axios.get(
                    `${API_BASE}/api/posts/classes/${activeCourse.id}`,
                    { withCredentials: true }
                  );
                  const normalizedPosts = normalizePosts(response.data);
                  setPosts(normalizedPosts);
                  // Update selected post with fresh data
                  const updatedPost = normalizedPosts.find(p => p.id === selectedPost.id);
                  if (updatedPost) {
                    setSelectedPost(updatedPost);
                  }
                } catch (err) {
                  console.error('Error refreshing posts:', err);
                }
              }}
            />
          ) : (
            /* Fallback - show welcome if nothing else matches */
            <div className="welcome-section">
              <div className="welcome-header">
                <h2 className="welcome-title">
                  <span className="wave-emoji">👋</span>
                  Welcome to classGPT!
                </h2>
                <p className="welcome-subtitle">
                  Select a post from the sidebar or click "New Post" to get started.
                </p>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Join Class Modal */}
      <JoinClassModel
        isOpen={showJoinClassModel}
        onClose={() => setShowJoinClassModel(false)}
        onJoin={handleJoinClassSubmit}
      />

      {/* Flag AI Response Modal */}
      {showFlagModal && (
        <div className="flag-modal-overlay" onClick={closeFlagModal}>
          <div className="flag-modal" onClick={(e) => e.stopPropagation()}>
            <div className="flag-modal-header">
              <h3>🚩 Flag AI Response</h3>
              <button className="flag-modal-close" onClick={closeFlagModal}>×</button>
            </div>
            
            <p className="flag-modal-description">
              Let your instructor know this AI response needs review. They'll be notified and can correct or improve it.
            </p>
            
            <div className="flag-modal-field">
              <label>Why are you flagging this response? (optional)</label>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                placeholder="e.g., The answer seems incorrect, The explanation is confusing, Missing important information..."
                rows={4}
              />
            </div>
            
            <div className="flag-modal-actions">
              <button 
                className="flag-cancel-btn"
                onClick={closeFlagModal}
                disabled={flagLoading}
              >
                Cancel
              </button>
              <button 
                className="flag-submit-btn"
                onClick={handleFlagAIResponse}
                disabled={flagLoading}
              >
                {flagLoading ? 'Submitting...' : '🚩 Submit Flag'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentDashboard;