import React, { useState } from 'react';
import './JoinClassModel.css';

const JoinClassModel = ({ isOpen, onClose, onJoin }) => {
  const [code, setCode] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;

    await onJoin(code.trim());
    setCode('');
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Join a Class</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Join code</label>
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ABC123"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button type="submit">Join</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JoinClassModel;
