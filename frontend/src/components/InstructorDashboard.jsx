import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StudentDashboard.css';
import InstructorPostView from './InstructorPostView';
import NewPostView from './NewPostView';
import ResourcesPage from './ResourcesPage';
import StatisticsPage from './StatisticsPage';
import JoinClassModel from './JoinClassModel';
import UserDropdown from './UserDropDown';
import LLMNotificationBell from './LLMNotificationBell';
import LLMReviewModal from './LLMReviewModal';
import './EnhancedModalStyles.css';
import './WelcomeSection.css';
import './LLMNotifications.css';

const API_BASE = 'http://localhost:8080';

// Helper function to strip HTML tags from text
const stripHtml = (html) => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

const InstructorDashboard = ({ onLogout, userName }) => {
const normalizePosts = (apiPosts) =>
  apiPosts.map((p) => {

    const author =
      (p.authorFirstName || p.authorLastName)
        ? `${p.authorFirstName || ''} ${p.authorLastName || ''}`.trim()
        : 'Unknown';

    const isInstructorPost = p.account && p.account.authorities
      ? p.account.authorities.some((auth) => auth.name === 'ROLE_ADMIN')
      : false;

    const created = p.createdAt ? new Date(p.createdAt) : null;
    const modified = p.modifiedAt ? new Date(p.modifiedAt) : null;

    const followups = (p.replies || []).map((r) => {
      const isLLMReply = Boolean(r.llmGenerated);



      // Debug: log raw reply data for AI/edited responses
      if (r.instructorEdited || r.endorsed || r.llmGenerated || r.replacedByInstructor) {
        console.log('=== REPLY NORMALIZATION DEBUG ===');
        console.log('Reply ID:', r.id);
        console.log('Raw API data:', {
          llmGenerated: r.llmGenerated,
          instructorEdited: r.instructorEdited,
          replacedByInstructor: r.replacedByInstructor,
          fromInstructor: r.fromInstructor,
          endorsed: r.endorsed,
          editedByName: r.editedByName
        });
        
        // Determine expected display type
        let expectedType;
        if (r.replacedByInstructor) expectedType = 'instructor (yellow)';
        else if (r.llmGenerated && r.instructorEdited) expectedType = 'instructor-ai (purple)';
        else if (r.llmGenerated && r.endorsed) expectedType = 'ai-endorsed (green)';
        else if (r.llmGenerated) expectedType = 'ai (blue)';
        else expectedType = 'student/instructor';
        console.log('Expected display type:', expectedType);
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
        isInstructorAnswer: r.isInstructorAnswer || r.replacedByInstructor || false, // ADDED
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

    const studentReplies = followups.filter(
      (r) => !r.fromInstructor && !r.isLLMReply && !r.isInstructorAnswer
    );
    
    // FIXED: First instructor response goes to Instructor's Answer section
    // Priority: 1) Formal instructor answer (isInstructorAnswer: true)
    //           2) First instructor reply (fromInstructor: true) if no formal answer exists
    const formalInstructorAnswer = followups.find(r => r.isInstructorAnswer === true);
    const firstInstructorReply = followups.find(r => r.fromInstructor && !r.isLLMReply);
    
    let instructorReplies = [];
    if (formalInstructorAnswer) {
      // Use the formal instructor answer
      instructorReplies = [formalInstructorAnswer];
    } else if (firstInstructorReply) {
      // Fall back to first instructor reply
      instructorReplies = [firstInstructorReply];
    }
    
    const aiReplies = followups.filter((r) => r.isLLMReply || r.llmGenerated);

    return {
      id: p.id,
      number: p.id,
      type: 'question',
      title: p.title,
      preview: p.body ? stripHtml(p.body).slice(0, 120) : '',
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

      // Student Answer (wiki-style) fields from API
      studentAnswer: p.studentAnswer || null,
      studentAnswerEndorsed: p.studentAnswerEndorsed || false,
      studentAnswerAuthor: p.studentAnswerAuthorName || null,
      studentAnswerUpdatedAt: p.studentAnswerUpdatedAt 
        ? new Date(p.studentAnswerUpdatedAt).toLocaleString() 
        : null,
      studentAnswerEndorsedBy: p.studentAnswerEndorsedByName || null,

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
  const [showStatistics, setShowStatistics] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);

  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [newCourse, setNewCourse] = useState({ code: '', name: '', term: '' });

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [courseCreatedInfo, setCourseCreatedInfo] = useState(null);
  const [showCourseCreatedModal, setShowCourseCreatedModal] = useState(false);
  const [courseCreateError, setCourseCreateError] = useState(null);

  const [isInstructor, setIsInstructor] = useState(false);

  // LLM Review Modal state
  const [showLLMReviewModal, setShowLLMReviewModal] = useState(false);
  const [selectedLLMNotification, setSelectedLLMNotification] = useState(null);

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
        const res = await axios.get(`${API_BASE}/api/classes/mine`, {
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
          `${API_BASE}/api/posts/classes/${activeCourse.id}`,
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
        `${API_BASE}/api/posts/${postId}/LLMReply`,
        {},
        { withCredentials: true }
      );

      const res = await axios.get(
        `${API_BASE}/api/posts/classes/${activeCourse.id}`,
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
      setError('Error generating LLM reply');
    }
  };

  const handleInstructorReply = async (postId, text, parentReplyId = null, isInstructorAnswer = false) => {
    if (!text.trim()) return;

    try {
      await axios.post(
        `${API_BASE}/api/posts/${postId}/replies`,
        {
          body: text,
          parentReplyId,
          isInstructorAnswer, // ADDED: Pass flag to backend
        },
        { withCredentials: true }
      );

      const res = await axios.get(
        `${API_BASE}/api/posts/classes/${activeCourse.id}`,
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

  const handleLikePost = async (postId) => {

    try {
      const response = await axios.post(
        `${API_BASE}/api/posts/${postId}/like`,
        {},
        { withCredentials: true }
      );

      const { liked, likeCount } = response.data;

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
          upvotes: likeCount,
        }));
      }
    } catch (err) {
      console.error('Error liking post:', err);
      setError('Error updating like');
    }
  };



  const handlePostUpdated = (updatedPostData) => {
    const normalizedPost = normalizePosts([updatedPostData])[0];


    setPosts(prevPosts =>
      prevPosts.map(p =>
        p.id === normalizedPost.id ? normalizedPost : p
      )
    );

  
    if (selectedPost && selectedPost.id === normalizedPost.id) {
      setSelectedPost(normalizedPost);
    }
  };





  const handleEndorseReply = async (postId, replyId) => {
    try {
      await axios.put(
        `${API_BASE}/api/posts/${postId}/replies/${replyId}/endorse`,
        {},
        { withCredentials: true }
      );

      const res = await axios.get(
        `${API_BASE}/api/posts/classes/${activeCourse.id}`,
        { withCredentials: true }
      );
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
        `${API_BASE}/api/posts/classes/${activeCourse.id}`,
        { title, body },
        { withCredentials: true }
      );

      const newPost = normalizePosts([response.data])[0];
      setPosts(prev => [newPost, ...prev]);
      setSelectedPost(newPost);
      setCreatedPost(false);
      setShowWelcome(false);
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
    setShowWelcome(false);
  };

  const handlePostClick = (postId) => {
    const post = posts.find((p) => p.id === postId);
    setSelectedPost(post);
    setShowStatistics(false);
    setShowWelcome(false);
  };

  const handleFilterClick = (filter) => {
    setSelectedFilter(filter);
  };

  const handleLogoClick = () => {
    setSelectedPost(null);
    setShowStatistics(false);
    setCreatedPost(false);
    setShowWelcome(true);
    setSelectedTab('qa');  // ADDED: Switch to Q&A tab when clicking logo
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

  // ADDED: Handler for joining a class by code
  const handleJoinClassSubmit = async (joinCode) => {
    try {
      await axios.post(
        `${API_BASE}/api/classes/join-by-code`,
        { code: joinCode },
        { withCredentials: true }
      );
      // Refresh courses list
      const res = await axios.get(`${API_BASE}/api/classes/mine`, {
        withCredentials: true,
      });
      const list = res.data || [];
      setCourses(list);
      if (list.length > 0 && !activeCourse) {
        setActiveCourse(list[0]);
      }
      setShowJoinClassModel(false);
    } catch (err) {
      console.error('Error joining class:', err);
      throw err;
    }
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
    setShowWelcome(false);
  };

  // LLM Review handlers
  const handleLLMReviewClick = (notification) => {
    setSelectedLLMNotification(notification);
    setShowLLMReviewModal(true);
  };

  const handleLLMReviewClose = () => {
    setShowLLMReviewModal(false);
    setSelectedLLMNotification(null);
  };

  const handleLLMReviewUpdate = async () => {
    // Refresh posts to show updated LLM response
    if (activeCourse) {
      try {
        const response = await axios.get(
          `${API_BASE}/api/posts/classes/${activeCourse.id}`,
          { withCredentials: true }
        );
        const normalizedPosts = normalizePosts(response.data);
        setPosts(normalizedPosts);

        // Update selected post if viewing one
        if (selectedPost) {
          const updatedPost = normalizedPosts.find(p => p.id === selectedPost.id);
          if (updatedPost) {
            setSelectedPost(updatedPost);
          }
        }
      } catch (err) {
        console.error('Error refreshing posts:', err);
      }
    }
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
      `${API_BASE}/api/classes/instructor-create`,
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

  const filterPosts = (postsToFilter) => {

    if (!searchQuery.trim()) return postsToFilter;

    const query = searchQuery.toLowerCase();

    return postsToFilter.filter(post => {

      if (post.title && post.title.toLowerCase().includes(query)) return true;

      if (post.content && post.content.toLowerCase().includes(query)) return true;

      if (post.author && post.author.toLowerCase().includes(query)) return true;
      if (post.tags && post.tags.some(tag => tag.toLowerCase().includes(query))) return true;
      return false;

    });

  };



  const filteredPosts =
    selectedFilter === 'all'
      ? filterPosts(posts)
      : filterPosts(posts.filter((post) => post.tags && post.tags.includes(selectedFilter)));
  const pinnedPosts = filteredPosts.filter((post) => post.isPinned);

  const regularPosts = filteredPosts.filter((post) => !post.isPinned);

  const effectiveSelectedPost =
  selectedPost ||
  regularPosts[0] ||
  pinnedPosts[0] ||
  null;

   return (
    <div className="student-dashboard">
      {showStatistics ? (
        <StatisticsPage posts={posts} onBack={() => setShowStatistics(false)} />
      ) : (
        <>
          {/* Header */}
          <header className="dashboard-header">
            <div className="header-left">
              <div className="logo" onClick={handleLogoClick} style={{ cursor: 'pointer' }}>
                classGPT
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
                            activeCourse && activeCourse.id === course.id ? 'active' : ''
                          }`}
                          onClick={() => handleCourseSelect(course)}
                        >
                          <div className="course-info">
                            <div className="course-code">{course.code}</div>
                            <div className="course-name">{course.name}</div>
                          </div>
                          {course.joinCode && (
                            <span className="course-join-code">{course.joinCode}</span>
                          )}
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
              {/* LLM Notification Bell */}
              <LLMNotificationBell 
                onReviewClick={handleLLMReviewClick}
                activeCourse={activeCourse}
              />
              
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
            onJoin={handleJoinClassSubmit}
          />

          <div className={`dashboard-content ${selectedTab !== 'qa' ? 'no-sidebar' : ''}`}>
            {/* Sidebar - Only show on Q&A tab */}
            {selectedTab === 'qa' && (
              <aside className="sidebar">
                <button 
                  className="new-post-btn" 
                  onClick={handleNewPost}
                  disabled={!activeCourse}
                  title={!activeCourse ? "Create a class to make posts" : "Create a new post"}
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

                  <div className="posts-list">
                    <div className="section-header">
                      <span className="dropdown-icon">▼</span>
                       <span>{searchQuery ? 'Search Results' : 'Today'}</span>
                    </div>
                    {regularPosts.length === 0 ? (
                      <div className="posts-list-empty">
                        
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
              ) : selectedTab === 'statistics' ? (
                <StatisticsPage posts={posts} onBack={() => setShowStatistics(false)} />
              ) : createdPost ? (
                <NewPostView
                  onSubmit={handleNewPostSubmit}
                  onCancel={() => setCreatedPost(false)}
                />
              ) : showWelcome || posts.length === 0 ? (
                /* Welcome / Getting Started Section */
                <div className="welcome-section">
                  <div className="welcome-header">
                    <h2 className="welcome-title">
                      <span className="wave-emoji">👋</span>
                      Welcome, Instructor!
                    </h2>
                    <p className="welcome-subtitle">
                      Manage your classes, engage with students, and leverage AI-assisted learning.
                    </p>
                  </div>

                  <div className="instructions-grid">
                    {/* Create a Class */}
                    <div className="instruction-card">
                      <div className="instruction-icon blue">📚</div>
                      <h3 className="instruction-title">Create a Class</h3>
                      <p className="instruction-description">
                        Set up a new course and invite your students with a join code.
                      </p>
                      <ol className="instruction-steps numbered">
                        <li>Click the course dropdown (top left)</li>
                        <li>Select "Add Course"</li>
                        <li>Enter course code, title, and term</li>
                        <li>Share the join code with students</li>
                      </ol>
                      <button className="instruction-action" onClick={handleAddCourse}>
                        Create Course <span className="arrow">→</span>
                      </button>
                    </div>

                    {/* Post Announcements */}
                    <div className="instruction-card">
                      <div className="instruction-icon green">📢</div>
                      <h3 className="instruction-title">Post & Announce</h3>
                      <p className="instruction-description">
                        Create posts, answer questions, and keep students informed.
                      </p>
                      <ol className="instruction-steps numbered">
                        <li>Click "New Post" to create content</li>
                        <li>Answer student questions directly</li>
                        <li>Pin important announcements</li>
                        <li>Use rich text formatting</li>
                      </ol>
                      <button className="instruction-action" onClick={handleNewPost}>
                        New Post <span className="arrow">→</span>
                      </button>
                    </div>

                    {/* Upload Resources */}
                    <div className="instruction-card">
                      <div className="instruction-icon orange">📁</div>
                      <h3 className="instruction-title">Upload Resources</h3>
                      <p className="instruction-description">
                        Share lecture slides, homework, and course materials.
                      </p>
                      <ol className="instruction-steps numbered">
                        <li>Go to the "Resources" tab</li>
                        <li>Click "Choose File" to select a document</li>
                        <li>Add a descriptive title (optional)</li>
                        <li>Click "Upload" - students can download!</li>
                      </ol>
                      <button className="instruction-action" onClick={() => setSelectedTab('resources')}>
                        Go to Resources <span className="arrow">→</span>
                      </button>
                    </div>

                    {/* AI Management */}
                    <div className="instruction-card">
                      <div className="instruction-icon purple">🚩</div>
                      <h3 className="instruction-title">Review Flagged Responses</h3>
                      <p className="instruction-description">
                        Students can flag AI responses they think are incorrect.
                      </p>
                      <ul className="instruction-steps">
                        <li><strong>🚩 Notifications:</strong> Click the flag icon when students report issues</li>
                        <li><strong>Review:</strong> Read the AI response and student concern</li>
                        <li><strong>Endorse:</strong> Mark correct AI answers with ✓</li>
                        <li><strong>Edit:</strong> Fix or replace incorrect responses</li>
                      </ul>
                    </div>

                    {/* View Statistics */}
                    <div className="instruction-card">
                      <div className="instruction-icon teal">📊</div>
                      <h3 className="instruction-title">View Analytics</h3>
                      <p className="instruction-description">
                        Track engagement, AI usage, and student participation.
                      </p>
                      <ul className="instruction-steps">
                        <li>Total posts, replies, and AI generations</li>
                        <li>Most active students leaderboard</li>
                        <li>AI response endorsement rates</li>
                        <li>Popular tags and topics</li>
                      </ul>
                      <button className="instruction-action" onClick={handleStatisticsClick}>
                        View Statistics <span className="arrow">→</span>
                      </button>
                    </div>

                    {/* Engage with Students */}
                    <div className="instruction-card">
                      <div className="instruction-icon red">💬</div>
                      <h3 className="instruction-title">Engage & Respond</h3>
                      <p className="instruction-description">
                        Build an active learning community.
                      </p>
                      <ul className="instruction-steps">
                        <li>Reply to student questions promptly</li>
                        <li>Endorse helpful student answers</li>
                        <li>Use followup discussions for clarification</li>
                        <li>Encourage peer-to-peer learning</li>
                      </ul>
                    </div>
                  </div>

                  {/* Quick Tips for Instructors */}
                  <div className="tips-section">
                    <h3 className="tips-title">💡 Instructor Tips</h3>
                    <ul className="tips-list">
                      <li className="tip-item">
                        <span className="tip-icon">🔑</span>
                        Share join codes via syllabus or email
                      </li>
                      <li className="tip-item">
                        <span className="tip-icon">✅</span>
                        Endorse AI answers to build student trust
                      </li>
                      <li className="tip-item">
                        <span className="tip-icon">📌</span>
                        Pin important weekly announcements
                      </li>
                      <li className="tip-item">
                        <span className="tip-icon">📈</span>
                        Check Statistics for engagement insights
                      </li>
                    </ul>
                  </div>
                </div>
              ) : (
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
                  onLikePost={handleLikePost}
                  onPostUpdated={handlePostUpdated}
                  onBack={() => setSelectedPost(null)}
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
                      const currentPostId = selectedPost?.id || regularPosts[0]?.id;
                      if (currentPostId) {
                        const updatedPost = normalizedPosts.find(p => p.id === currentPostId);
                        if (updatedPost) {
                          setSelectedPost(updatedPost);
                        }
                      }
                    } catch (err) {
                      console.error('Error refreshing posts:', err);
                    }
                  }}
                />
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
                    <h2>Couldn't Create Course</h2>
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

          {/* LLM REVIEW MODAL */}
          <LLMReviewModal
            isOpen={showLLMReviewModal}
            onClose={handleLLMReviewClose}
            notification={selectedLLMNotification}
            onUpdate={handleLLMReviewUpdate}
          />
        </>
      )}
    </div>
  );
};

export default InstructorDashboard;