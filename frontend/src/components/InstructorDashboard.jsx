import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudentDashboard.css'; // Use the same CSS as StudentDashboard
import InstructorPostView from './InstructorPostView';
import NewPostView from './NewPostView';
import ResourcesPage from './ResourcesPage';
import StatisticsPage from './StatisticsPage';
import JoinClassModel from './JoinClassModel';
import UserDropdown from './UserDropDown';
import AccountSettings from './AccountSettings';

const InstructorDashboard = ({ onLogout, userName }) => {

  const normalizePosts = (apiPosts) =>
    apiPosts.map((p) => {
      const author = p.account
        ? `${p.account.firstName || ''} ${p.account.lastName || ''}`.trim()
        : 'Unknown';

      const isInstructorPost = p.account && p.account.authorities
        ? p.account.authorities.some(auth => auth.name === 'ROLE_ADMIN')
        : false;

      const created = p.createdAt ? new Date(p.createdAt) : null;

      const replies = (p.replies || []).map((r) => ({
        id: r.id,
        author: r.author
          ? `${r.author.firstName || ''} ${r.author.lastName || ''}`.trim()
          : 'Unknown',
        time: r.createdAt ? new Date(r.createdAt).toLocaleString() : '',
        content: r.body,
        fromInstructor: r.fromInstructor || false,
        LLMGenerated: r.LLMGenerated || false,
        endorsed: r.endorsed || false,
      }));

      // Separate replies into categories
      const studentReplies = replies.filter(r => !r.fromInstructor && !r.LLMGenerated);
      const instructorReplies = replies.filter(r => r.fromInstructor && !r.LLMGenerated);
      const aiReplies = replies.filter(r => r.LLMGenerated);
      const followups = replies; // For compatibility with PostView

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
        replies: replies,
        studentReplies: studentReplies,
        instructorReplies: instructorReplies,
        aiReplies: aiReplies,
        followupDiscussions: [],
        followups: followups,
      };
    });

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

  // Sample courses data
  const courses = [
    {
      id: 1,
      code: 'CS 484',
      name: 'Secure Web Application Development',
      term: 'Fall 2025',
      isActive: true
    },
    {
      id: 2,
      code: 'CS 421',
      name: 'Natural Language Processing',
      term: 'Fall 2025',
      isActive: false
    }
  ];

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPosts = async () => {
      try {
        const response = await axios.get('https://cs484-project-ci-cd.onrender.com/api/posts', {
          withCredentials: true
        });
        const normalizedPosts = normalizePosts(response.data);
        setPosts(normalizedPosts);
      } catch (err) {
        setError('Error fetching posts');
      } finally {
        setLoading(false);
      }
    };
    fetchPosts();
  }, []);

  const handleLLMReply = async (postId) => {
    try {
      await axios.post(`https://cs484-project-ci-cd.onrender.com/api/posts/${postId}/LLMReply`, {}, {
        withCredentials: true
      });

      const res = await axios.get('https://cs484-project-ci-cd.onrender.com/api/posts', {
        withCredentials: true
      });
      const normalized = normalizePosts(res.data);
      setPosts(normalized);

      const updatedPost = normalized.find(p => p.id === postId);
      if (updatedPost) {
        setSelectedPost(updatedPost);
      }
    } catch (err) {
      console.error(err);
      setError('Error generating LLM reply');
    }
  };

  const handleInstructorReply = async (postId, text) => {
    try {
      await axios.post(`https://cs484-project-ci-cd.onrender.com/api/posts/${postId}/replies`, { body: text }, {
        withCredentials: true
      });

      const res = await axios.get('https://cs484-project-ci-cd.onrender.com/api/posts', {
        withCredentials: true
      });
      const normalized = normalizePosts(res.data);
      setPosts(normalized);

      const updatedPost = normalized.find(p => p.id === postId);
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
        `https://cs484-project-ci-cd.onrender.com/api/posts/${postId}/replies/${replyId}/endorse`,
        {},
        { withCredentials: true }
      );

      const res = await axios.get('https://cs484-project-ci-cd.onrender.com/api/posts', {
        withCredentials: true
      });
      const normalized = normalizePosts(res.data);
      setPosts(normalized);

      const updatedPost = normalized.find(p => p.id === postId);
      if (updatedPost) {
        setSelectedPost(updatedPost);
      }
    } catch (err) {
      console.error('Error endorsing reply:', err);
    }
  };

  const handleNewPostSubmit = async (title, body) => {
    try {
      const response = await axios.post(`https://cs484-project-ci-cd.onrender.com/api/posts`, { title, body }, {
        withCredentials: true
      });

      const newPost = normalizePosts([response.data])[0];
      setPosts(prevPosts => [newPost, ...prevPosts]);

      setSelectedPost(newPost);
      setCreatedPost(false);
    } catch (err) {
      console.error(err);
      setError('Error posting new question');
    }
  };

  // Sample statistics
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
    studentResponses: 8
  };

  const handleNewPost = () => {
    setCreatedPost(true);
    setShowStatistics(false);
  };

  const handlePostClick = (postId) => {
    const post = posts.find(p => p.id === postId);
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

  const handleCourseSelect = (courseId) => {
    console.log('Selected course:', courseId);
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
      console.log('Logging out');
      window.location.reload();
    }
  };

  const handleStatisticsClick = () => {
    setShowStatistics(true);
    setSelectedPost(null);
    setCreatedPost(false);
  };

  // Filter posts based on selected filter
  const filteredPosts = selectedFilter === 'all'
    ? posts
    : posts.filter(post => post.tags && post.tags.includes(selectedFilter));

  // Get pinned posts from main posts array
  const pinnedPosts = posts.filter(post => post.isPinned);

  // Get non-pinned posts for the Today section
  const regularPosts = filteredPosts.filter(post => !post.isPinned);

  return (
    <div className="student-dashboard">
      {showAccountSettings ? (
        <AccountSettings onBack={() => setShowAccountSettings(false)} />
      ) : showStatistics ? (
        <StatisticsPage
          posts={posts}
          onBack={() => setShowStatistics(false)}
        />
      ) : (
        <>
          {/* Header */}
          <header className="dashboard-header">
            <div className="header-left">
              <div className="logo" onClick={handleLogoClick}>piazza</div>
              <div className="course-dropdown-container">
                <div className="course-dropdown" onClick={toggleCourseDropdown}>
                  <span>CS 484</span>
                  <span className="dropdown-icon">▼</span>
                </div>

                {showCourseDropdown && (
                  <div className="course-dropdown-menu">
                    <div className="dropdown-header">
                      <h3>MY CLASSES</h3>
                      <span className="course-term">Fall 2025</span>
                    </div>
                    <div className="dropdown-divider"></div>
                    <div className="course-list">
                      {courses.map(course => (
                        <div
                          key={course.id}
                          className={`course-item ${course.isActive ? 'active' : ''}`}
                          onClick={() => handleCourseSelect(course.id)}
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
                    <button className="join-class-btn" onClick={handleJoinAnotherClass}>
                      Join Another Class
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
                <button
                  className="statistics-tab"
                  onClick={handleStatisticsClick}
                >
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

          {/* Sub-navigation */}
          <nav className="sub-nav">
            <button
              className={`nav-item ${selectedFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterClick('all')}
            >
              all
            </button>
            <button
              className={`nav-item ${selectedFilter === 'hw4' ? 'active' : ''}`}
              onClick={() => handleFilterClick('hw4')}
            >
              hw4
            </button>
            <button
              className={`nav-item ${selectedFilter === 'project' ? 'active' : ''}`}
              onClick={() => handleFilterClick('project')}
            >
              project
            </button>
            <button
              className={`nav-item ${selectedFilter === 'exam' ? 'active' : ''}`}
              onClick={() => handleFilterClick('exam')}
            >
              exam
            </button>
            <button
              className={`nav-item ${selectedFilter === 'logistics' ? 'active' : ''}`}
              onClick={() => handleFilterClick('logistics')}
            >
              logistics
            </button>
            <button
              className={`nav-item ${selectedFilter === 'topics' ? 'active' : ''}`}
              onClick={() => handleFilterClick('topics')}
            >
              topics
            </button>
            <button
              className={`nav-item ${selectedFilter === 'hw5' ? 'active' : ''}`}
              onClick={() => handleFilterClick('hw5')}
            >
              hw5
            </button>
          </nav>

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
                  {pinnedPosts.map(post => (
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
                  {regularPosts.map(post => (
                    <div
                      key={post.id}
                      className={`post-item ${post.isUnread ? 'unread' : ''}`}
                      onClick={() => handlePostClick(post.id)}
                    >
                      <div className="post-content">
                        <div className="post-title">
                          {post.title}
                          {post.isInstructorPost && (
                            <span style={{ marginLeft: '8px', color: '#ff9800', fontSize: '10px' }}>
                              👨‍🏫
                            </span>
                          )}
                        </div>
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
                <ResourcesPage isInstructor={true} />
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
                <InstructorPostView
                  post={selectedPost}
                  currentUser={userName || 'Instructor'}
                  onBack={() => setSelectedPost(null)}
                  onLLMReply={handleLLMReply}
                  onInstructorReply={handleInstructorReply}
                  onEndorse={handleEndorseReply}
                />
              ) : (
                <>
                  <div className="terms-notice">
                    <a href="#">Terms of Service</a>: In the event of a conflict between these Payment Terms and the Terms of Service, these Payment Terms shall govern.
                  </div>

                  <h2 className="section-title">Class at a Glance</h2>

                  <div className="glance-cards">
                    <div className="status-row">
                      <div className={`status-card ${stats.allCaughtUp ? 'success' : 'warning'}`}>
                        <div className="status-icon">
                          {stats.allCaughtUp ? '✓' : '!'}
                        </div>
                        <div className="status-content">
                          <div className="status-title">
                            {stats.allCaughtUp ? 'All caught up' : 'Unread Posts'}
                          </div>
                          <div className="status-subtitle">
                            {stats.allCaughtUp ? 'No unread posts' : `${stats.unreadPosts} unread posts`}
                          </div>
                        </div>
                      </div>

                      <div className="status-card warning">
                        <div className="status-icon">!</div>
                        <div className="status-content">
                          <div className="status-title">Needs Attention</div>
                          <div className="status-subtitle">{stats.unansweredQuestions} unanswered questions</div>
                        </div>
                      </div>

                      <div className="status-card warning">
                        <div className="status-icon">!</div>
                        <div className="status-content">
                          <div className="status-title">Needs Attention</div>
                          <div className="status-subtitle">{stats.unansweredFollowups} unanswered followups</div>
                        </div>
                      </div>
                    </div>

                    <div className="stats-row">
                      <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-value">{stats.totalPosts}</div>
                        <div className="stat-label">Total Posts</div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-value">{stats.totalContributions}</div>
                        <div className="stat-label">Total Contributions</div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon">🎓</div>
                        <div className="stat-value">{stats.studentsEnrolled}</div>
                        <div className="stat-label">Students Enrolled</div>
                      </div>

                      <div className="stat-card license">
                        <div className="stat-label">License Status</div>
                        <div className="license-value">contribution-supported</div>
                        <div className="license-icon">🏫</div>
                      </div>
                    </div>

                    <div className="engagement-row">
                      <div className="engagement-card">
                        <div className="engagement-header">
                          <div>
                            <div className="engagement-title">Instructor Engagement</div>
                            <div className="engagement-value">{stats.instructorEngagement}</div>
                            <div className="engagement-subtitle">instructor responses</div>
                          </div>
                          <div className="engagement-icon">🍎</div>
                        </div>
                      </div>

                      <div className="engagement-card">
                        <div className="engagement-header">
                          <div>
                            <div className="engagement-title">Student Participation</div>
                            <div className="engagement-value">{stats.studentParticipation}</div>
                            <div className="engagement-subtitle">student responses</div>
                          </div>
                          <div className="engagement-icon">👥</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </main>
          </div>

          {/* Join Class Model */}
          <JoinClassModel
            isOpen={showJoinClassModel}
            onClose={() => setShowJoinClassModel(false)}
          />
        </>
      )}
    </div>
  );
};

export default InstructorDashboard;