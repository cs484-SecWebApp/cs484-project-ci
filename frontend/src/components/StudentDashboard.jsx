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

const StudentDashboard = ({ onLogout, userName }) => {
const normalizePosts = (apiPosts) =>
  apiPosts.map((p) => {
    // Author comes from PostSummary
    const author =
      (p.authorFirstName || p.authorLastName)
        ? `${p.authorFirstName || ''} ${p.authorLastName || ''}`.trim()
        : 'Unknown';

    const isInstructorPost = !!p.instructorPost;

    const created = p.createdAt ? new Date(p.createdAt) : null;
    const modified = p.modifiedAt ? new Date(p.modifiedAt) : null;

  
    const followups = (p.replies || []).map((r) => {
      const isLLMReply = Boolean(r.llmGenerated);

      // Debug: log instructor replies
      if (r.fromInstructor || r.author?.firstName === 'admin' || r.author?.lastName === 'admin') {
        console.log('=== INSTRUCTOR REPLY DEBUG ===');
        console.log('Reply ID:', r.id);
        console.log('fromInstructor:', r.fromInstructor);
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
          fromInstructor: r.fromInstructor || r.replacedByInstructor || false,
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
      preview: p.body ? p.body.slice(0, 120) : '',
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
        { body: text, parentReplyId },
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
      console.log('Logging out');
      window.location.reload();
    }
  };

  const handleJoinClassSubmit = async (joinCode) => {
    try {
      await axios.post(
        `${API_BASE}/api/classes/join-by-code`,
        { code: joinCode },
        { withCredentials: true }
      );

      await loadCourses(); // new course appears; first in list becomes active
      setShowJoinClassModel(false);
    } catch (err) {
      console.error(err);
      alert('Error joining class – please check the code.');
    }
  };

  // ===== SEARCH FILTER LOGIC =====
  const filterPosts = (postsToFilter) => {
    if (!searchQuery.trim()) return postsToFilter;
    
    const query = searchQuery.toLowerCase();
    return postsToFilter.filter(post => {
      // Search in title
      if (post.title && post.title.toLowerCase().includes(query)) return true;
      
      // Search in content/body
      if (post.content && post.content.toLowerCase().includes(query)) return true;
      
      // Search in author name
      if (post.author && post.author.toLowerCase().includes(query)) return true;
      
      // Search in tags
      if (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query))) return true;
      
      return false;
    });
  };

  const pinnedPosts = filterPosts(posts.filter((post) => post.isPinned));
  const regularPosts = filterPosts(posts.filter((post) => !post.isPinned));

  return (
    <div className="student-dashboard">
      {showAccountSettings ? (
        <AccountSettings onBack={() => setShowAccountSettings(false)} />
      ) : (
        <>
          {/* Header */}
          <header className="dashboard-header">
            <div className="header-left">
              <div
                className="logo"
                onClick={handleLogoClick}
                style={{ cursor: 'pointer' }}
              >
                piazza
              </div>
              <div className="course-dropdown-container">
                <div className="course-dropdown" onClick={toggleCourseDropdown}>
                  {coursesLoading
                    ? 'Loading...'
                    : activeCourse
                    ? activeCourse.code
                    : 'No class selected'}
                  <span className="dropdown-icon">▼</span>
                </div>
                {showCourseDropdown && (
                  <div className="course-dropdown-menu">
                    <div className="dropdown-header">
                      <h3>
                        {activeCourse
                          ? `${activeCourse.code} ${activeCourse.name}`
                          : 'My Classes'}
                      </h3>
                      <span className="course-term">
                        {activeCourse ? activeCourse.term : ''}
                      </span>
                    </div>
                    <div className="dropdown-divider"></div>

                    <div className="course-list">
                      {courses.length === 0 && !coursesLoading && (
                        <div className="course-item disabled">
                          <div className="course-info">
                            <div className="course-name">No classes yet</div>
                          </div>
                        </div>
                      )}

                      {courses.map((course) => (
                        <div
                          key={course.id}
                          className={`course-item ${
                            activeCourse && activeCourse.id === course.id
                              ? 'active'
                              : ''
                          }`}
                          onClick={() => handleCourseSelect(course)}
                        >
                          <div className="course-info">
                            <div className="course-code">{course.code}</div>
                            <div className="course-name">{course.name}</div>
                          </div>
                          <span className="course-term-badge">
                            {course.term}
                          </span>
                        </div>
                      ))}
                    </div>

                    <div className="dropdown-divider"></div>
                    <div className="dropdown-footer">
                      <button className="dropdown-link">
                        Show inactive classes
                      </button>
                      <button className="dropdown-link">
                        Manage class dropdown
                      </button>
                    </div>
                    <div className="dropdown-divider"></div>
                    <button
                      className="join-class-btn"
                      onClick={handleJoinAnotherClass}
                    >
                      → Join Another Class
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="header-center">
              <div className="nav-tabs">
                <button
                  className={selectedTab === 'qa' ? 'active' : ''}
                  onClick={() => setSelectedTab('qa')}
                >
                  Q & A
                </button>
                <button
                  className={selectedTab === 'resources' ? 'active' : ''}
                  onClick={() => setSelectedTab('resources')}
                >
                  Resources
                </button>
              </div>
            </div>
            <div className="header-right">
              <div className="user-info" style={{ position: 'relative' }}>
                <span>{userName || 'User'}</span>
                <div
                  className="user-avatar"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                  style={{ cursor: 'pointer' }}
                >
                  {(userName || 'U').charAt(0).toUpperCase()}
                </div>
                <UserDropdown
                  isOpen={showUserDropdown}
                  onClose={() => setShowUserDropdown(false)}
                  onAccountSettings={handleAccountSettings}
                  onJoinClass={handleJoinAnotherClass}
                  onLogout={handleLogout}
                  userName={userName || 'User'}
                />
              </div>
            </div>
          </header>

          <div className={`dashboard-content ${selectedTab !== 'qa' ? 'no-sidebar' : ''}`}>
            {/* Sidebar - Only show on Q&A tab */}
            {selectedTab === 'qa' && (
              <aside className="sidebar">
                <button
                  className="new-post-btn"
                  onClick={handleNewPost}
                  disabled={!activeCourse}
                >
                  <span className="plus-icon">⊕</span> New Post
                </button>

                <div className="search-box">
                  <input
                    type="text"
                    placeholder="Search posts..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button 
                      className="clear-search-btn"
                      onClick={() => setSearchQuery('')}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px',
                        color: '#999',
                        padding: '4px'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>

                {searchQuery && (
                  <div style={{ 
                    padding: '8px 16px', 
                    fontSize: '12px', 
                    color: '#666',
                    background: '#f5f5f5',
                    borderRadius: '4px',
                    margin: '0 16px 8px'
                  }}>
                    Found {pinnedPosts.length + regularPosts.length} result{pinnedPosts.length + regularPosts.length !== 1 ? 's' : ''} for "{searchQuery}"
                  </div>
                )}

                <div className="posts-section">
                  <div className="posts-header">
                    <button className="all-posts-btn">
                      <span className="filter-icon">☰</span> All Posts
                    </button>
                    <button className="menu-icon">⋮</button>
                  </div>

                  {pinnedPosts.length > 0 && (
                    <div className="pinned-section">
                      <div className="section-header">
                        <span className="dropdown-icon">▼</span>
                        <span>Pinned</span>
                      </div>
                      {pinnedPosts.map((post) => (
                        <div
                          key={post.id}
                          className="pinned-post"
                          onClick={() => handlePostClick(post.id)}
                        >
                          <span className="pin-icon">📌</span>
                          <div className="post-info">
                            <div className="post-title">{post.title}</div>
                            {post.preview && (
                              <div className="post-preview">{post.preview}</div>
                            )}
                          </div>
                          <div className="post-date">{post.time}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="posts-list">
                    <div className="section-header">
                      <span className="dropdown-icon">▼</span>
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
                          } ${post.isInstructorPost ? 'instructor-post' : ''}`}
                          onClick={() => handlePostClick(post.id)}
                        >
                          <div className="post-content">
                            <div className="post-title-row">
                              {post.isInstructorPost && (
                                <span className="instructor-post-badge" title="Posted by instructor">👨‍🏫</span>
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
                      Welcome to Piazza!
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
                        <li>Submit and wait for responses!</li>
                      </ol>
                      <button className="instruction-action" onClick={() => setCreatedPost(true)}>
                        New Post <span className="arrow">→</span>
                      </button>
                    </div>

                    {/* AI Assistant */}
                    <div className="instruction-card">
                      <div className="instruction-icon purple">🤖</div>
                      <h3 className="instruction-title">AI Assistant</h3>
                      <p className="instruction-description">
                        Get instant help from our AI tutor powered by Gemini.
                      </p>
                      <ol className="instruction-steps numbered">
                        <li>Open any post/question</li>
                        <li>Click the "AI" button in the actions bar</li>
                        <li>AI generates a helpful response</li>
                        <li>Click "Let's talk more" to chat further</li>
                        <li>Flag incorrect answers for instructor review</li>
                      </ol>
                    </div>

                    {/* Navigate & Engage */}
                    <div className="instruction-card">
                      <div className="instruction-icon orange">💡</div>
                      <h3 className="instruction-title">Navigate & Engage</h3>
                      <p className="instruction-description">
                        Find answers quickly and contribute to discussions.
                      </p>
                      <ul className="instruction-steps">
                        <li>Use the search bar to find existing posts</li>
                        <li>Check "Pinned" posts for important announcements</li>
                        <li>Reply to help other students</li>
                        <li>Upvote helpful answers</li>
                        <li>🚩 Flag AI responses if they seem incorrect</li>
                      </ul>
                    </div>
                  </div>

                  {/* Quick Tips */}
                  <div className="tips-section">
                    <h3 className="tips-title">💡 Pro Tips</h3>
                    <ul className="tips-list">
                      <li className="tip-item">
                        <span className="tip-icon">🔍</span>
                        Search before posting - your question might be answered!
                      </li>
                      <li className="tip-item">
                        <span className="tip-icon">📝</span>
                        Include code snippets and error messages
                      </li>
                      <li className="tip-item">
                        <span className="tip-icon">⭐</span>
                        Star posts to bookmark them for later
                      </li>
                      <li className="tip-item">
                        <span className="tip-icon">🚩</span>
                        Flag AI answers that seem wrong - instructors will review
                      </li>
                    </ul>
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
                      Welcome to Piazza!
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

          {/* Flag Modal Styles */}
          <style>{`
            .flag-modal-overlay {
              position: fixed;
              top: 0;
              left: 0;
              right: 0;
              bottom: 0;
              background: rgba(0, 0, 0, 0.6);
              display: flex;
              align-items: center;
              justify-content: center;
              z-index: 1000;
              animation: fadeIn 0.2s ease;
            }

            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }

            .flag-modal {
              background: #36393f;
              border-radius: 12px;
              padding: 0;
              max-width: 450px;
              width: 90%;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
              animation: slideIn 0.2s ease;
            }

            @keyframes slideIn {
              from {
                opacity: 0;
                transform: scale(0.95) translateY(-10px);
              }
              to {
                opacity: 1;
                transform: scale(1) translateY(0);
              }
            }

            .flag-modal-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 16px 20px;
              background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
              border-radius: 12px 12px 0 0;
            }

            .flag-modal-header h3 {
              margin: 0;
              color: white;
              font-size: 18px;
              font-weight: 600;
            }

            .flag-modal-close {
              background: rgba(255, 255, 255, 0.2);
              border: none;
              color: white;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              font-size: 18px;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: background 0.15s ease;
            }

            .flag-modal-close:hover {
              background: rgba(255, 255, 255, 0.3);
            }

            .flag-modal-description {
              padding: 16px 20px 0;
              color: #b9bbbe;
              font-size: 14px;
              line-height: 1.5;
              margin: 0;
            }

            .flag-modal-field {
              padding: 16px 20px;
            }

            .flag-modal-field label {
              display: block;
              color: #dcddde;
              font-size: 13px;
              font-weight: 500;
              margin-bottom: 8px;
            }

            .flag-modal-field textarea {
              width: 100%;
              background: #2f3136;
              border: 1px solid #4a4d52;
              border-radius: 8px;
              padding: 12px;
              color: #dcddde;
              font-size: 14px;
              line-height: 1.5;
              resize: vertical;
              font-family: inherit;
              transition: border-color 0.2s ease;
            }

            .flag-modal-field textarea:focus {
              outline: none;
              border-color: #e74c3c;
            }

            .flag-modal-field textarea::placeholder {
              color: #72767d;
            }

            .flag-modal-actions {
              display: flex;
              justify-content: flex-end;
              gap: 12px;
              padding: 16px 20px;
              background: #2f3136;
              border-radius: 0 0 12px 12px;
            }

            .flag-cancel-btn {
              background: transparent;
              border: 1px solid #4a4d52;
              color: #b9bbbe;
              padding: 10px 20px;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .flag-cancel-btn:hover:not(:disabled) {
              background: #3c3f45;
              color: #fff;
            }

            .flag-submit-btn {
              background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
              border: none;
              color: white;
              padding: 10px 20px;
              border-radius: 6px;
              font-size: 14px;
              font-weight: 500;
              cursor: pointer;
              transition: all 0.15s ease;
            }

            .flag-submit-btn:hover:not(:disabled) {
              transform: translateY(-1px);
              box-shadow: 0 4px 12px rgba(231, 76, 60, 0.3);
            }

            .flag-submit-btn:disabled,
            .flag-cancel-btn:disabled {
              opacity: 0.6;
              cursor: not-allowed;
            }

            /* ADDED: Sidebar visual indicators */
            .post-title-row {
              display: flex;
              align-items: center;
              gap: 6px;
              width: 100%;
            }

            .instructor-post-badge {
              font-size: 14px;
              flex-shrink: 0;
            }

            .post-item.instructor-post {
              border-left: 3px solid #f39c12;
              background: linear-gradient(to right, rgba(243, 156, 18, 0.05), transparent);
            }

            .endorsed-indicator {
              margin-left: auto;
              color: #27ae60;
              font-weight: bold;
              font-size: 16px;
              flex-shrink: 0;
            }
          `}</style>
        </>
      )}
    </div>
  );
};

export default StudentDashboard;