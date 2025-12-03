import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './ResourcesPage.css';

const API_BASE = 'http://localhost:8080';

const ResourcesPage = ({ activeCourse, isInstructor }) => {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);


  // Fetch resources whenever the active course changes
  useEffect(() => {
    if (!activeCourse) {
      setResources([]);
      return;
    }

    const fetchResources = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(
          `${API_BASE}/api/courses/${activeCourse.id}/resources`,
          { withCredentials: true }
        );
        setResources(res.data || []);
      } catch (err) {
        console.error(err);
        setError('Error loading resources.');
      } finally {
        setLoading(false);
      }
    };

    fetchResources();
  }, [activeCourse]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0] || null;
    setUploadFile(file);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!activeCourse || !uploadFile) return;

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();

      formData.append('file', uploadFile);

      const meta = { title: uploadTitle || uploadFile.name };
      formData.append(
        'meta',
        new Blob([JSON.stringify(meta)], { type: 'application/json' })
      );

      const res = await axios.post(
        `${API_BASE}/api/courses/${activeCourse.id}/resources`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      // Append new resource to list
      setResources((prev) => [res.data, ...prev]);
      setUploadFile(null);
      setUploadTitle('');
    } catch (err) {
      console.error(err);
      setError('Error uploading resource.');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (resourceId) => {
    if (!activeCourse) return;
    if (!window.confirm('Delete this resource?')) return;

    try {
      await axios.delete(
        `${API_BASE}/api/courses/${activeCourse.id}/resources/${resourceId}`,
        { withCredentials: true }
      );

      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    } catch (err) {
      console.error(err);
      setError('Error deleting resource.');
    }
  };

  if (!activeCourse) {
    return (
      <div className="resources-page">
        <div className="resources-header">
          <h1>Resources</h1>
        </div>
        <p>Please select a course to view resources.</p>
      </div>
    );
  }

  return (
    <div className="resources-page">
      <div className="resources-header">
        <h1>Resources</h1>
        <p className="course-subtitle">
          {activeCourse.code} – {activeCourse.name}
        </p>
      </div>

      {error && <div className="resources-error">{error}</div>}

      {isInstructor && (
        <form className="resource-upload-form" onSubmit={handleUpload}>
          <div className="upload-row">
            <div className="upload-field">
              <label htmlFor="resource-file">Upload file</label>
              <input
                id="resource-file"
                type="file"
                onChange={handleFileChange}
              />
            </div>

            <div className="upload-field">
              <label htmlFor="resource-title">Title (optional)</label>
              <input
                id="resource-title"
                type="text"
                placeholder="e.g., Homework 1, Lecture 3 slides"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="upload-button"
              disabled={uploading || !uploadFile}
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      )}

      <div className="resources-list-container">
        {loading ? (
          <div className="resources-loading">Loading resources…</div>
        ) : resources.length === 0 ? (
          <div className="resources-empty">
            No resources have been uploaded yet.
          </div>
        ) : (
          <table className="resources-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Filename</th>
                <th>Uploaded</th>
                <th style={{ width: '1%' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.map((r) => (
                <tr key={r.id}>
                  <td>{r.title || r.originalFilename}</td>
                  <td>{r.originalFilename}</td>
                  <td>
                    {r.uploadedAt
                      ? new Date(r.uploadedAt).toLocaleString()
                      : ''}
                  </td>
                  <td className="resource-actions">
                    <a
                      className="resource-download-link"
                      href={`${API_BASE}/api/courses/${activeCourse.id}/resources/${r.id}/download`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download
                    </a>
                    {isInstructor && (
                      <button
                        type="button"
                        className="resource-delete-button"
                        onClick={() => handleDelete(r.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ResourcesPage;
