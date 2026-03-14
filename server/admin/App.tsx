import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './styles/common.css';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Devices from './pages/Devices';
import Users from './pages/Users';
import Organizations from './pages/Organizations';
import Profile from './pages/Profile';
import Playlists from './pages/Playlists';
import Campaigns from './pages/Campaigns';
import Settings from './pages/Settings';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if user is already authenticated
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            setIsAuthenticated(true);
            setUser(data.user);
          }
        }
      } catch (err) {
        console.error('Error checking authentication:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="App">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
            )
          }
        />
        <Route
          path="/dashboard"
          element={
            isAuthenticated ? (
              <Dashboard 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/devices"
          element={
            isAuthenticated ? (
              <Devices 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/users"
          element={
            isAuthenticated ? (
              <Users 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/organizations"
          element={
            isAuthenticated ? (
              <Organizations 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/profile"
          element={
            isAuthenticated ? (
              <Profile 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/playlists"
          element={
            isAuthenticated ? (
              <Playlists 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/campaigns"
          element={
            isAuthenticated ? (
              <Campaigns 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/settings"
          element={
            isAuthenticated ? (
              <Settings 
                user={user} 
                setIsAuthenticated={setIsAuthenticated} 
                setUser={setUser} 
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
        <Route
          path="/verify-email/:token"
          element={
            isAuthenticated ? (
              <Navigate to="/dashboard" replace />
            ) : (
              <Login setIsAuthenticated={setIsAuthenticated} setUser={setUser} />
            )
          }
        />
        <Route
          path="*"
          element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />}
        />
      </Routes>
    </Router>
  );
}

export default App;