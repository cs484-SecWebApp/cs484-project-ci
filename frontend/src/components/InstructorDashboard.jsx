import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudentDashboard.css';
import InstructorPostView from './InstructorPostView';
import NewPostView from './NewPostView';
import ResourcesPage from './ResourcesPage';
import StatisticsPage from './StatisticsPage';
import JoinClassModel from './JoinClassModel';
import UserDropdown from './UserDropDown';
import AccountSettings from './AccountSettings';

const API_BASE = 'http://localhost:8080';

const InstructorDashboard = ({ onLogout, userName }) => {
const normalizePosts = (apiPosts) =>
  apiPosts.map((p) => {
    const author = p.account
      ? `${p.account.firstName || ''} ${p.account.lastName || ''}`.trim()
      : 'Unknown';

    const isInstructorPost = p.account && p.account.authorities
      ? p.account.authorities.some((auth) => auth.name === 'ROLE_ADMIN')
      : false;

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
        llmGenerated: isLLMReply,
        fromInstructor: r.fromInstructor || false,
        endorsed: r.endorsed || false,
        time: r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
        content: r.body,
      };
    });

    const studentReplies = followups.filter(
      (r) => !r.fromInstructor && !r.isLLMReply
    );
    const instructorReplies = followups.filter(
      (r) => r.fromInstructor && !r.isLLMReply
    );
    const aiReplies = followups.filter((r) => r.isLLMReply);

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
      isInstructorPost,
      tag: p.tag || 'general',
      tags: p.tags && p.tags.length ? p.tags : [p.tag || 'general'],
      isPinned: p.pinned || p.isPinned || false,
      isUnread: false,
      upvotes: p.upVotes ?? 0,
      views: 0,

  
      studentReplies,
      instructorReplies,
      aiReplies,
      followupDiscussions: [],  // unused for now

      followups,
    };
  });



  const [courses, setCourses] = useState([]);          // [{id, code, name, term}]
  const [activeCourse, setActiveCourse] = useState(null);
  const [coursesLoading, setCoursesLoading] = useState(true);

  const [selectedTab, setSelectedTab] = useState('qa');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPost, setSelectedPost] = useState(null);
  const [createdPost, setCreatedPost] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [showCourseDropdown, setShowCourseDropdown] = useState(false);
  const [showJoinClassModel, setShowJoinClassModel] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [showStatistics, setShowStatistics] = useState(false);

  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ code: '', name: '', term: '' });

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [courseCreatedInfo, setCourseCreatedInfo] = useState(null);
  const [showCourseCreatedModal, setShowCourseCreatedModal] = useState(false);
  const [courseCreateError, setCourseCreateError] = useState(null);

  const [isInstructor, setIsInstructor] = useState(false);
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
    const fetchCourses = async () => {
      try {
        const res = await axios.get('http://localhost:8080/api/classes/mine', {
          withCredentials: true,
        });
        const list = res.data || [];
        setCourses(list);
        if (list.length > 0) {
          setActiveCourse(list[0]); // pick first as active
        }
      } catch (err) {
        console.error(err);
        setError('Error fetching courses');
      } finally {
        setCoursesLoading(false);
      }
    };
    fetchCourses();
  }, []);


  useEffect(() => {
    if (!activeCourse) {
      setPosts([]);
      return;
    }

    const fetchPosts = async () => {
      try {
        const response = await axios.get(
          `http://localhost:8080/api/posts/classes/${activeCourse.id}`,
          { withCredentials: true }
        );
        console.log('Instructor raw posts:', response.data); 
        const normalizedPosts = normalizePosts(response.data);
        console.log('Instructor normalized posts:', normalizedPosts); 
        setPosts(normalizedPosts);
      } catch (err) {
        console.error(err);
        setError('Error fetching posts');
      } finally {
        setLoading(false);
      }
    };

    fetchPosts();
  }, [activeCourse]);

  const handleLLMReply = async (postId) => {
    try {
      await axios.post(
        `http://localhost:8080/api/posts/${postId}/LLMReply`,
        {},
        { withCredentials: true }
      );

      const res = await axios.get('http://localhost:8080/api/posts', {
        withCredentials: true,
      });
      const normalized = normalizePosts(res.data);
      setPosts(normalized);

      const updatedPost = normalized.find((p) => p.id === postId);
      if (updatedPost) {
        setSelectedPost(updatedPost);
      }
    } catch (err) {
      console.error(err);
      setError('Error generating LLM reply');
    }
  };

  const handleInstructorReply = async (postId, text, parentReplyId = null) => {
    if (!text.trim()) return;

    try {
      await axios.post(
        `http://localhost:8080/api/posts/${postId}/replies`,
        {
          body: text,
          parentReplyId,
        },
        { withCredentials: true }
      );

      const res = await axios.get(
        `http://localhost:8080/api/posts/classes/${activeCourse.id}`,
        { withCredentials: true }
      );
      const normalized = normalizePosts(res.data);
      setPosts(normalized);

      const updatedPost = normalized.find((p) => p.id === postId);
      if (updatedPost) {
        setSelectedPost(updatedPost);
      }
    } catch (err) {
      console.error(err);
      setError('Error saving reply');
    }
  };



  const handleEndorseReply = async (postId, replyId) => {
    try {
      await axios.put(
        `http://localhost:8080/api/posts/${postId}/replies/${replyId}/endorse`,
        {},
        { withCredentials: true }
      );

      const res = await axios.get('http://localhost:8080/api/posts', {
        withCredentials: true,
      });
      const normalized = normalizePosts(res.data);
      setPosts(normalized);

      const updatedPost = normalized.find((p) => p.id === postId);
      if (updatedPost) {
        setSelectedPost(updatedPost);
      }
    } catch (err) {
      console.error('Error endorsing reply:', err);
    }
  };

  const handleNewPostSubmit = async (title, body) => {
    if (!activeCourse) return; 

    try {
      const response = await axios.post(
        `http://localhost:8080/api/posts/classes/${activeCourse.id}`,
        { title, body },
        { withCredentials: true }
      );

      const newPost = normalizePosts([response.data])[0];
      setPosts(prev => [newPost, ...prev]);
      setSelectedPost(newPost);
      setCreatedPost(false);
    } catch (err) {
      console.error(err);
      setError('Error posting new question');
    }
  };

  // Sample statistics (still fake)
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

  const handleNewPost = () => {
    setCreatedPost(true);
    setShowStatistics(false);
  };

  const handlePostClick = (postId) => {
    const post = posts.find((p) => p.id === postId);
    setSelectedPost(post);
    setShowStatistics(false);
  };

  const handleFilterClick = (filter) => {
    setSelectedFilter(filter);
  };

  const handleLogoClick = () => {
    setSelectedPost(null);
    setShowStatistics(false);
  };


  const handleCourseSelect = (course) => {
    setActiveCourse(course);
    setShowCourseDropdown(false);
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
      window.location.reload();
    }
  };

  const handleStatisticsClick = () => {
    setShowStatistics(true);
    setSelectedPost(null);
    setCreatedPost(false);
  };


const handleAddCourse = () => {
  setNewCourse({ code: '', name: '', term: '' });
  setCourseCreatedInfo(null);
  setCourseCreateError(null);
  setShowCreateCourseModal(true);
};

const handleCreateCourseSubmit = async (e) => {
  e.preventDefault();
  const { code, name, term } = newCourse;
  if (!code || !name || !term) return;

  try {
    const res = await axios.post(
      'http://localhost:8080/api/classes/instructor-create',
      { code, name, term },
      { withCredentials: true }
    );

    const created = res.data;
    setCourses(prev => [...prev, created]);
    setActiveCourse(created);

    setShowCreateCourseModal(false);

    setCourseCreateError(null);

    setCourseCreatedInfo(created);
    setShowCourseCreatedModal(true);
  } catch (err) {
    console.error(err);
    setError('Error creating course');

    setCourseCreatedInfo(null);
    setCourseCreateError('Error creating course – check backend logs.');
    setShowCourseCreatedModal(true);
  }
};


  const filteredPosts =
    selectedFilter === 'all'
      ? posts
      : posts.filter((post) => post.tags && post.tags.includes(selectedFilter));

  const pinnedPosts = posts.filter((post) => post.isPinned);
  const regularPosts = filteredPosts.filter((post) => !post.isPinned);

  const effectiveSelectedPost =
  selectedPost ||
  regularPosts[0] ||
  pinnedPosts[0] ||
  null;

   return (
    <div className="student-dashboard">
      {showAccountSettings ? (
        <AccountSettings onBack={() => setShowAccountSettings(false)} />
      ) : showStatistics ? (
        <StatisticsPage posts={posts} onBack={() => setShowStatistics(false)} />
      ) : (
        <>
          {/* Header */}
          <header className="dashboard-header">
            <div className="header-left">
              <div className="logo" onClick={handleLogoClick}>
                piazza
              </div>
              <div className="course-dropdown-container">
                <div className="course-dropdown" onClick={toggleCourseDropdown}>
                  <span>
                    {coursesLoading
                      ? 'Loading...'
                      : activeCourse
                      ? activeCourse.code
                      : 'No classes yet'}
                  </span>
                  <span className="dropdown-icon">▼</span>
                </div>

                {showCourseDropdown && (
                  <div className="course-dropdown-menu">
                    <div className="dropdown-header">
                      <h3>MY CLASSES</h3>
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
                          <span className="course-term-badge">{course.term}</span>
                        </div>
                      ))}
                    </div>

                    <div className="dropdown-divider"></div>
                    <div className="dropdown-footer">
                      <button className="dropdown-link">View All Classes</button>
                      <button className="dropdown-link">Class Settings</button>
                    </div>
                    <div className="dropdown-divider"></div>

                    {/* For instructors: Add Course button */}
                    <button className="join-class-btn" onClick={handleAddCourse}>
                      Add Course
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
                <button className="statistics-tab" onClick={handleStatisticsClick}>
                  Statistics
                </button>
              </nav>
            </div>

            <div className="header-right">
              <div className="user-info" style={{ position: 'relative' }}>
                <button
                  className="user-avatar"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                >
                  {userName ? userName.charAt(0).toUpperCase() : 'I'}
                </button>
                <UserDropdown
                  isOpen={showUserDropdown}
                  onClose={() => setShowUserDropdown(false)}
                  onAccountSettings={handleAccountSettings}
                  onJoinClass={handleJoinAnotherClass}
                  onLogout={handleLogout}
                  userName={userName || 'Instructor'}
                />
              </div>
            </div>
          </header>

          <JoinClassModel
            isOpen={showJoinClassModel}
            onClose={() => setShowJoinClassModel(false)}
          />

          <div className="dashboard-content">
            {/* Sidebar */}
            <aside className="sidebar">
              <button className="new-post-btn" onClick={handleNewPost}>
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
                  {regularPosts.map((post) => (
                    <div
                      key={post.id}
                      className={`post-item ${post.isUnread ? 'unread' : ''}`}
                      onClick={() => handlePostClick(post.id)}
                    >
                      <div className="post-content">
                        <div className="post-title">{post.title}</div>
                        <div className="post-preview">{post.preview}</div>
                      </div>
                      <div className="post-meta">
                        <div className="post-time">{post.time}</div>
                        {post.isUnread && <div className="unread-badge">📋</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
              {selectedTab === 'resources' ? (
                <ResourcesPage activeCourse={activeCourse} isInstructor={isInstructor}/>
              ) : selectedTab === 'statistics' ? (
                <StatisticsPage posts={posts} onBack={() => setShowStatistics(false)} />
              ) : createdPost ? (
                <NewPostView
                  onSubmit={handleNewPostSubmit}
                  onCancel={() => setCreatedPost(false)}
                />
              ) : posts.length > 0 ? (
                <InstructorPostView
                  posts={regularPosts}
                  pinnedPosts={pinnedPosts}
                  loading={loading}
                  error={error}
                  selectedPost={selectedPost || regularPosts[0]}
                  onPostClick={handlePostClick}
                  onFilterClick={handleFilterClick}
                  selectedFilter={selectedFilter}
                  onLLMReply={handleLLMReply}
                  onInstructorReply={handleInstructorReply}
                  onEndorseReply={handleEndorseReply}
                />
              ) : (
                <>
                  {/* same “Class at a Glance” placeholder as student, if you want */}
                  <div className="terms-notice">
                    <a href="#">Terms of Service</a>: In the event of a conflict between
                    these Payment Terms and the Terms of Service, these Payment Terms
                    shall govern.
                  </div>

                  <h2 className="section-title">Class at a Glance</h2>
                  {/* cards using your stats object, like the student version */}
                </>
              )}
            </main>
          </div>


          {/* CREATE COURSE FORM MODAL */}
          {showCreateCourseModal && (
            <div className="modal-overlay">
              <div className="modal">
                <h2>Create New Course</h2>
                <form onSubmit={handleCreateCourseSubmit}>
                  <div className="form-group">
                    <label>Course code (e.g. CS 484)</label>
                    <input
                      type="text"
                      value={newCourse.code}
                      onChange={(e) =>
                        setNewCourse((prev) => ({ ...prev, code: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Course title</label>
                    <input
                      type="text"
                      value={newCourse.name}
                      onChange={(e) =>
                        setNewCourse((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Term (e.g. Fall 2025)</label>
                    <input
                      type="text"
                      value={newCourse.term}
                      onChange={(e) =>
                        setNewCourse((prev) => ({ ...prev, term: e.target.value }))
                      }
                      required
                    />
                  </div>

                  <div className="modal-actions">
                    <button
                      type="button"
                      onClick={() => setShowCreateCourseModal(false)}
                    >
                      Cancel
                    </button>
                    <button type="submit">Create Course</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* COURSE CREATED / ERROR MODAL */}
          {showCourseCreatedModal && (
            <div className="modal-overlay">
              <div className="modal">
                {courseCreateError ? (
                  <>
                    <h2>Couldn’t Create Course</h2>
                    <p>{courseCreateError}</p>
                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCourseCreatedModal(false);
                          setCourseCreateError(null);
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <h2>Course Created 🎉</h2>
                    {courseCreatedInfo && (
                      <>
                        <p>
                          <strong>{courseCreatedInfo.code}</strong> –{' '}
                          {courseCreatedInfo.name}
                          <br />
                          <span style={{ fontSize: '0.9rem', color: '#666' }}>
                            {courseCreatedInfo.term}
                          </span>
                        </p>

                        {courseCreatedInfo.joinCode && (
                          <div className="form-group">
                            <label>Student join code</label>
                            <div
                              style={{
                                padding: '8px 12px',
                                borderRadius: '4px',
                                border: '1px solid #ccc',
                                fontFamily: 'monospace',
                                display: 'inline-block',
                              }}
                            >
                              {courseCreatedInfo.joinCode}
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    <div className="modal-actions">
                      <button
                        type="button"
                        onClick={() => {
                          setShowCourseCreatedModal(false);
                          setCourseCreatedInfo(null);
                        }}
                      >
                        Done
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InstructorDashboard;

