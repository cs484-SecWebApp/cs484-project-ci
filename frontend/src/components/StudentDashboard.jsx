import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudentDashboard.css';
import PostView from './PostView';
import NewPostView from './NewPostView';
import ResourcesPage from './ResourcesPage';
import JoinClassModel from './JoinClassModel';
import UserDropdown from './UserDropDown';
import AccountSettings from './AccountSettings';

const API_BASE = 'http://localhost:8080';

const StudentDashboard = ({ onLogout, userName }) => {
  const normalizePosts = (apiPosts) =>
    apiPosts.map((p) => {
      const author = p.account
        ? `${p.account.firstName || ''} ${p.account.lastName || ''}`.trim()
        : 'Unknown';

      const created = p.createdAt ? new Date(p.createdAt) : null;

      const followups = (p.replies || []).map((r) => {
        const isLLMReply = Boolean(r.llmGenerated);

        const authorName = isLLMReply
          ? 'AI Tutor'
          : (r.author
              ? `${r.author.firstName || ''} ${r.author.lastName || ''}`.trim()
              : 'Unknown');

        return {
          id: r.id,
          author: authorName,
          parentReplyId: r.parentReplyId ?? null,
          isLLMReply,
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
        updatedAt: p.modifiedAt || '',
        author,
        tag: p.tag || 'general',
        tags: p.tags && p.tags.length ? p.tags : [p.tag || 'general'],
        isPinned: p.pinned || p.isPinned || false,
        isUnread: false,
        upvotes: p.upVotes ?? 0,
        views: 0,
        LLMGeneratedAnswer: p.LLMGeneratedAnswerText,
        studentAnswer: p.studentAnswerText,
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

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [isInstructor, setIsInstructor] = useState(false);

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

      const instructorLike = roles.includes('ROLE_ADMIN');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- load posts for the active course ----------
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
  }, [activeCourse]); // re-run when course changes

  // ---------- actions that depend on activeCourse ----------
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
    } catch (err) {
      console.error(err);
      setError('Error posting new question');
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
  };

  const handlePostClick = (postId) => {
    const post = posts.find((p) => p.id === postId);
    setSelectedPost(post);
  };

  const handleLogoClick = () => {
    setSelectedPost(null);
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

  const pinnedPosts = posts.filter((post) => post.isPinned);
  const regularPosts = posts.filter((post) => !post.isPinned);

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

          <div className="dashboard-content">
            {/* Sidebar */}
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
              </div>

              <div className="posts-section">
                <div className="posts-header">
                  <button className="all-posts-btn">
                    <span className="filter-icon">☰</span> All Posts
                  </button>
                  <button className="menu-icon">⋮</button>
                </div>

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

                <div className="posts-list">
                  <div className="section-header">
                    <span className="dropdown-icon">▼</span>
                    <span>Today</span>
                  </div>
                  {loading ? (
                    <div className="no-posts-placeholder">Loading posts…</div>
                  ) : error ? (
                    <div className="no-posts-placeholder">{error}</div>
                  ) : regularPosts.length === 0 ? (
                    <div className="no-posts-placeholder">
                      No posts yet in this class.
                    </div>
                  ) : (
                    regularPosts.map((post) => (
                      <div
                        key={post.id}
                        className={`post-item ${
                          post.isUnread ? 'unread' : ''
                        }`}
                        onClick={() => handlePostClick(post.id)}
                      >
                        <div className="post-content">
                          <div className="post-title">{post.title}</div>
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

            {/* Main Content */}
            <main className="main-content">
              {selectedTab === 'resources' ? (
                <ResourcesPage activeCourse={activeCourse} isInstructor={true} />
              ) : createdPost ? (
                <NewPostView
                  onCancel={() => setCreatedPost(false)}
                  onPostCreated={async (post) => {
                    setCreatedPost(false);
                    setSelectedPost(post);
                  }}
                  onSubmit={handleNewPostSubmit}
                />
              ) : selectedPost ? (
                <PostView
                  post={selectedPost}
                  currentUser={userName || 'User'}
                  onBack={() => setSelectedPost(null)}
                  onLLMReply={handleLLMReply}
                  onFollowupSubmit={handleFollowupSubmit}
                />
              ) : (
                <>
                  <h2 className="section-title">Class at a Glance</h2>
                  {/* existing glance cards / stats here */}
                </>
              )}
            </main>
          </div>

          {/* Join Class Modal */}
          <JoinClassModel
            isOpen={showJoinClassModel}
            onClose={() => setShowJoinClassModel(false)}
            onJoin={handleJoinClassSubmit}
          />
        </>
      )}
    </div>
  );
};

export default StudentDashboard;
