import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import '../styles/Settings.css';

interface SettingsProps {
  user: any;
  setUser: (user: any) => void;
  setIsAuthenticated: (isAuth: boolean) => void;
}

const Settings: React.FC<SettingsProps> = ({ user, setUser, setIsAuthenticated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Placeholder for app settings
  const [darkMode, setDarkMode] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30);

  // For future implementation - load settings from API or localStorage
  useEffect(() => {
    // Load settings from localStorage as a temporary solution
    const savedSettings = localStorage.getItem('appSettings');
    if (savedSettings) {
      try {
        const parsedSettings = JSON.parse(savedSettings);
        setDarkMode(parsedSettings.darkMode || false);
        setNotificationsEnabled(parsedSettings.notificationsEnabled !== false);
        setAutoRefresh(parsedSettings.autoRefresh !== false);
        setRefreshInterval(parsedSettings.refreshInterval || 30);
      } catch (err) {
        console.error('Error parsing saved settings:', err);
      }
    }
  }, []);

  const saveSettings = () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Save settings to localStorage for now
      // In a real implementation, you would save to backend API
      const settingsToSave = {
        darkMode,
        notificationsEnabled,
        autoRefresh,
        refreshInterval
      };
      
      localStorage.setItem('appSettings', JSON.stringify(settingsToSave));
      
      // Apply dark mode if selected
      if (darkMode) {
        document.body.classList.add('dark-mode');
      } else {
        document.body.classList.remove('dark-mode');
      }
      
      setSuccess('Settings saved successfully');
    } catch (err) {
      setError('Failed to save settings');
      console.error('Error saving settings:', err);
    } finally {
      setLoading(false);
    }
  };

  // Get logout function to pass to Layout
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="settings-container">
        <h1>Settings</h1>
        
        {loading && <p className="loading">Saving settings...</p>}
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <div className="settings-sections">
          <section className="settings-section">
            <h2>Application Settings</h2>
            
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="darkMode">Dark Mode</label>
                <p className="setting-description">Use dark theme for the application interface</p>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="darkMode"
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="notifications">Notifications</label>
                <p className="setting-description">Enable notifications for device status changes</p>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="notifications"
                    checked={notificationsEnabled}
                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
          </section>
          
          <section className="settings-section">
            <h2>Dashboard Settings</h2>
            
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="autoRefresh">Auto Refresh</label>
                <p className="setting-description">Automatically refresh device status</p>
              </div>
              <div className="setting-control">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    id="autoRefresh"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
            </div>
            
            <div className="setting-item">
              <div className="setting-label">
                <label htmlFor="refreshInterval">Refresh Interval (seconds)</label>
                <p className="setting-description">How often to refresh device status</p>
              </div>
              <div className="setting-control">
                <input
                  type="number"
                  id="refreshInterval"
                  min="5"
                  max="300"
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(parseInt(e.target.value) || 30)}
                  disabled={!autoRefresh}
                  className="form-control"
                />
              </div>
            </div>
          </section>
          
          <section className="settings-section">
            <h2>System Information</h2>
            <div className="system-info">
              <p><strong>Version:</strong> 1.0.0</p>
              <p><strong>User:</strong> {user?.email || 'Unknown'}</p>
              <p><strong>Role:</strong> {user?.role || 'User'}</p>
              <p><strong>Last Login:</strong> {new Date().toLocaleString()}</p>
            </div>
          </section>
          
          <div className="settings-actions">
            <button
              className="primary-button"
              onClick={saveSettings}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;