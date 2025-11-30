import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './StatisticsPage.css';

const StatisticsPage = ({ posts, onBack }) => {
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalStudentPosts: 0,
    totalInstructorPosts: 0,
    totalReplies: 0,
    totalStudentReplies: 0,
    totalInstructorReplies: 0,
    totalAIReplies: 0,
    totalEndorsements: 0,
    averageRepliesPerPost: 0,
    mostActiveStudents: [],
    recentAIGenerations: [],
    popularTags: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStatistics();
  }, [posts]);

  const fetchStatistics = async () => {
    try {
      setLoading(true);
      
      // Fetch AI statistics from backend
      const response = await axios.get('https://cs484-project-ci-cd.onrender.com/api/posts/statistics', {
        withCredentials: true
      });
      
      const backendStats = response.data;
      
      // Calculate frontend statistics from posts prop
      calculateStatistics(backendStats);
      
    } catch (err) {
      console.error('Error fetching statistics:', err);
      setError('Failed to load statistics');
      // Fallback to calculating from posts prop if backend fails
      calculateStatisticsFromPosts();
    } finally {
      setLoading(false);
    }
  };

  const calculateStatistics = (backendStats) => {
    if (!posts || posts.length === 0) {
      return;
    }

    const totalPosts = posts.length;
    const totalStudentPosts = posts.filter(p => !p.isInstructorPost).length;
    const totalInstructorPosts = posts.filter(p => p.isInstructorPost).length;

    let totalReplies = backendStats.totalReplies || 0;
    let totalStudentReplies = 0;
    let totalInstructorReplies = 0;
    let totalAIReplies = backendStats.totalAIReplies || 0;
    let totalEndorsements = backendStats.totalEndorsements || 0;
    
    const studentReplyCount = {};
    const tagCount = {};

    posts.forEach(post => {
      totalStudentReplies += post.studentReplies?.length || 0;
      totalInstructorReplies += post.instructorReplies?.length || 0;

      // Track student activity
      post.studentReplies?.forEach(reply => {
        if (reply.author && reply.author !== 'Unknown') {
          studentReplyCount[reply.author] = (studentReplyCount[reply.author] || 0) + 1;
        }
      });

      // Count tags
      post.tags?.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // Calculate most active students
    const mostActiveStudents = Object.entries(studentReplyCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Format AI generations from backend
    const recentAIGenerations = backendStats.aiGenerations?.map(gen => ({
      postTitle: gen.postTitle,
      postId: gen.postId,
      time: new Date(gen.generatedAt).toLocaleString(),
      endorsed: gen.endorsed,
      replyBody: gen.replyBody,
      replyId: gen.replyId,
    })) || [];

    // Get popular tags
    const popularTags = Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const averageRepliesPerPost = totalPosts > 0 ? (totalReplies / totalPosts).toFixed(1) : 0;

    setStats({
      totalPosts,
      totalStudentPosts,
      totalInstructorPosts,
      totalReplies,
      totalStudentReplies,
      totalInstructorReplies,
      totalAIReplies,
      totalEndorsements,
      averageRepliesPerPost,
      mostActiveStudents,
      recentAIGenerations,
      popularTags,
    });
  };

  const calculateStatisticsFromPosts = () => {
    // Fallback method if backend fails
    if (!posts || posts.length === 0) {
      return;
    }

    const totalPosts = posts.length;
    const totalStudentPosts = posts.filter(p => !p.isInstructorPost).length;
    const totalInstructorPosts = posts.filter(p => p.isInstructorPost).length;

    let totalReplies = 0;
    let totalStudentReplies = 0;
    let totalInstructorReplies = 0;
    let totalAIReplies = 0;
    let totalEndorsements = 0;
    const studentReplyCount = {};
    const aiGenerations = [];
    const tagCount = {};

    posts.forEach(post => {
      totalReplies += post.replies?.length || 0;
      totalStudentReplies += post.studentReplies?.length || 0;
      totalInstructorReplies += post.instructorReplies?.length || 0;
      totalAIReplies += post.aiReplies?.length || 0;

      // Count endorsements
      post.replies?.forEach(reply => {
        if (reply.endorsed) {
          totalEndorsements++;
        }
      });

      // Track student activity
      post.studentReplies?.forEach(reply => {
        if (reply.author && reply.author !== 'Unknown') {
          studentReplyCount[reply.author] = (studentReplyCount[reply.author] || 0) + 1;
        }
      });

      // Track AI generations
      post.aiReplies?.forEach(reply => {
        aiGenerations.push({
          postTitle: post.title,
          postId: post.id,
          time: reply.time,
          endorsed: reply.endorsed,
          replyBody: reply.content,
          replyId: reply.id,
        });
      });

      // Count tags
      post.tags?.forEach(tag => {
        tagCount[tag] = (tagCount[tag] || 0) + 1;
      });
    });

    // Calculate most active students
    const mostActiveStudents = Object.entries(studentReplyCount)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Sort AI generations by most recent
    const recentAIGenerations = aiGenerations
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 20);

    // Get popular tags
    const popularTags = Object.entries(tagCount)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const averageRepliesPerPost = totalPosts > 0 ? (totalReplies / totalPosts).toFixed(1) : 0;

    setStats({
      totalPosts,
      totalStudentPosts,
      totalInstructorPosts,
      totalReplies,
      totalStudentReplies,
      totalInstructorReplies,
      totalAIReplies,
      totalEndorsements,
      averageRepliesPerPost,
      mostActiveStudents,
      recentAIGenerations,
      popularTags,
    });
  };

  if (loading) {
    return (
      <div className="statistics-page">
        <div className="stats-header">
          <button className="back-btn" onClick={onBack}>← Back to Feed</button>
          <h1 className="stats-title">📊 Course Statistics</h1>
        </div>
        <div className="empty-state">Loading statistics...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="statistics-page">
        <div className="stats-header">
          <button className="back-btn" onClick={onBack}>← Back to Feed</button>
          <h1 className="stats-title">📊 Course Statistics</h1>
        </div>
        <div className="empty-state" style={{ color: '#d32f2f' }}>{error}</div>
      </div>
    );
  }

  return (
    <div className="statistics-page">
      <div className="stats-header">
        <button className="back-btn" onClick={onBack}>← Back to Feed</button>
        <h1 className="stats-title">📊 Course Statistics</h1>
      </div>

      <div className="stats-grid">
        {/* Overview Cards */}
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalPosts}</div>
            <div className="stat-label">Total Posts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👥</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalStudentPosts}</div>
            <div className="stat-label">Student Posts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">👨‍🏫</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalInstructorPosts}</div>
            <div className="stat-label">Instructor Posts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💬</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalReplies}</div>
            <div className="stat-label">Total Replies</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📚</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalStudentReplies}</div>
            <div className="stat-label">Student Replies</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✏️</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalInstructorReplies}</div>
            <div className="stat-label">Instructor Replies</div>
          </div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-icon">🤖</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalAIReplies}</div>
            <div className="stat-label">AI Replies Generated</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">✔</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalEndorsements}</div>
            <div className="stat-label">Endorsed Answers</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <div className="stat-value">{stats.averageRepliesPerPost}</div>
            <div className="stat-label">Avg Replies/Post</div>
          </div>
        </div>
      </div>

      {/* AI Generations Table */}
      <div className="stats-section">
        <h2 className="section-title">🤖 Recent AI Generations</h2>
        <div className="ai-generations-table">
          {stats.recentAIGenerations.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Post</th>
                  <th>Post ID</th>
                  <th>Generated At</th>
                  <th>Status</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAIGenerations.map((gen, index) => (
                  <tr key={index}>
                    <td className="post-title-cell">{gen.postTitle}</td>
                    <td>@{gen.postId}</td>
                    <td>{gen.time}</td>
                    <td>
                      {gen.endorsed ? (
                        <span className="status-badge endorsed">✓ Endorsed</span>
                      ) : (
                        <span className="status-badge">Pending</span>
                      )}
                    </td>
                    <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {gen.replyBody ? gen.replyBody.substring(0, 100) + '...' : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">No AI replies generated yet</div>
          )}
        </div>
      </div>

      {/* Most Active Students */}
      <div className="stats-section">
        <h2 className="section-title">🏆 Most Active Students</h2>
        <div className="leaderboard">
          {stats.mostActiveStudents.length > 0 ? (
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Replies</th>
                </tr>
              </thead>
              <tbody>
                {stats.mostActiveStudents.map((student, index) => (
                  <tr key={index}>
                    <td className="rank-cell">
                      {index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}
                    </td>
                    <td>{student.name}</td>
                    <td>{student.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="empty-state">No student activity yet</div>
          )}
        </div>
      </div>

      {/* Popular Tags */}
      <div className="stats-section">
        <h2 className="section-title">🏷️ Popular Tags</h2>
        <div className="tags-cloud">
          {stats.popularTags.length > 0 ? (
            stats.popularTags.map((tagData, index) => (
              <div key={index} className="tag-stat">
                <span className="tag-name">{tagData.tag}</span>
                <span className="tag-count">{tagData.count} posts</span>
              </div>
            ))
          ) : (
            <div className="empty-state">No tags used yet</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StatisticsPage;