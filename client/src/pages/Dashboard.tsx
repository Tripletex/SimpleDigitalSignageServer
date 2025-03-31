import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeviceRegistration } from '../services/deviceService';
import moment from 'moment';
import Layout from '../components/Layout';
import '../App.css';
import '../styles/Dashboard.css';

interface DashboardProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, setIsAuthenticated, setUser }) => {
  const [deviceRegistrations, setDeviceRegistrations] = useState<DeviceRegistration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/device/list?onlyClaimed=true');
        if (!response.ok) {
          throw new Error(`Failed to fetch devices: ${response.status}`);
        }
        const data = await response.json();
        
        setDeviceRegistrations(data);
        setError(null);
      } catch (err) {
        setError(`Error fetching devices: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching devices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      
      if (response.ok) {
        setIsAuthenticated(false);
        setUser(null);
        navigate('/login');
      } else {
        throw new Error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  // Calculate device status based on last seen timestamp
  const getDeviceStatus = (lastSeen: Date): { status: string; color: string } => {
    const lastSeenMoment = moment(lastSeen);
    const now = moment();
    const minutesSinceLastSeen = now.diff(lastSeenMoment, 'minutes');
    
    if (minutesSinceLastSeen < 5) {
      return { status: 'Online', color: 'green' };
    } else if (minutesSinceLastSeen < 60) {
      return { status: 'Idle', color: 'orange' };
    } else {
      return { status: 'Offline', color: 'red' };
    }
  };

  // Format date
  const formatDate = (date: Date): string => {
    return moment(date).format("YYYY-MM-DD HH:mm:ss");
  };

  // Calculate time since for better readability
  const getTimeSince = (date: Date): string => {
    return moment(date).fromNow();
  };
  
  // Get exact timestamp for tooltip
  const getExactTimestamp = (date: Date): string => {
    return moment(date).format("YYYY-MM-DD HH:mm:ss [UTC]Z");
  };

  // Calculate device status counts
  const getDeviceStatusCounts = () => {
    let onlineCount = 0;
    let idleCount = 0;
    let offlineCount = 0;
    
    deviceRegistrations.forEach(registration => {
      const lastSeenMoment = moment(registration.lastSeen);
      const now = moment();
      const minutesSinceLastSeen = now.diff(lastSeenMoment, 'minutes');
      
      if (minutesSinceLastSeen < 5) {
        onlineCount++;
      } else if (minutesSinceLastSeen < 60) {
        idleCount++;
      } else {
        offlineCount++;
      }
    });
    
    return { onlineCount, idleCount, offlineCount };
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="dashboard-container">
        <h1>Claimed Devices Dashboard</h1>
        
        {loading && <p>Loading devices...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && deviceRegistrations.length === 0 && (
          <div className="empty-dashboard">
            <p>No devices found.</p>
          </div>
        )}
        
        {deviceRegistrations.length > 0 && (() => {
          const { onlineCount, idleCount, offlineCount } = getDeviceStatusCounts();
          const totalCount = deviceRegistrations.length;
          
          return (
            <div className="device-stats-container">
              <div className="device-total-box">
                <h2>Total Devices</h2>
                <div className="device-count">{totalCount}</div>
              </div>
              
              <div className="status-boxes">
                <div className="status-box online">
                  <h3>Online</h3>
                  <div className="status-count">{onlineCount}</div>
                  <div className="status-indicator status-online"></div>
                </div>
                
                <div className="status-box idle">
                  <h3>Idle</h3>
                  <div className="status-count">{idleCount}</div>
                  <div className="status-indicator status-idle"></div>
                </div>
                
                <div className="status-box offline">
                  <h3>Offline</h3>
                  <div className="status-count">{offlineCount}</div>
                  <div className="status-indicator status-offline"></div>
                </div>
              </div>
              
              <div className="last-updated">
                Last updated: {formatDate(new Date())}
                <span className="timestamp-info" title="Updates every 30 seconds">ⓘ</span>
              </div>
            </div>
          );
        })()}
      </div>
    </Layout>
  );
};

export default Dashboard;