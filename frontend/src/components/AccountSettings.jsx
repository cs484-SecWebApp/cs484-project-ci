import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './AccountSettings.css';

const API_BASE = 'http://localhost:8080';

const AccountSettings = ({ onBack }) => {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAccount = async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await axios.get(`${API_BASE}/api/accounts/me`, {
          withCredentials: true,
        });

        setAccount(res.data);
      } catch (err) {
        console.error('Failed to fetch account info', err);
        setError('Error loading account information.');
      } finally {
        setLoading(false);
      }
    };

    fetchAccount();
  }, []);

  const fullName = account
    ? `${account.firstName || ''} ${account.lastName || ''}`.trim()
    : '';

  return (
    <div className="account-settings">
      <button className="back-button" onClick={onBack}>
        ← Back
      </button>

      <h1 className="settings-title">Account Info</h1>

      <section className="settings-section">
        {loading ? (
          <p>Loading account information…</p>
        ) : error ? (
          <p className="error-text">{error}</p>
        ) : (
          <div className="settings-row simple-settings-row">
            <div className="settings-left">
              {/* Name */}
              <div className="form-group">
                <label>Full Name</label>
                <div className="readonly-field">
                  {fullName || 'Not set'}
                </div>
              </div>

              {/* Email */}
              <div className="form-group">
                <label>Email</label>
                <div className="readonly-field">
                  {account?.email || 'Not set'}
                </div>
                <p className="field-hint">
                  This is the email associated with your Piazza account.
                </p>
              </div>


              {/* Roles (optional, but nice debug info) */}
              {account?.roles && account.roles.length > 0 && (
                <div className="form-group">
                  <label>Roles</label>
                  <div className="readonly-field">
                    {account.roles.join(', ')}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default AccountSettings;
