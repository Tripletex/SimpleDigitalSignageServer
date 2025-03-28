import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DeviceRegistration } from '../../../shared/src/deviceData';
import moment from 'moment';
import '../App.css';

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
        const response = await fetch('/api/device/list');
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

  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <h1>Digital Signage Device Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ marginRight: '20px', fontSize: '1rem' }}>
              Welcome, {user?.displayName || user?.username}
            </span>
            <button 
              onClick={handleLogout} 
              style={{
                background: '#61dafb',
                border: 'none',
                borderRadius: '4px',
                padding: '8px 16px',
                cursor: 'pointer',
                color: '#282c34',
                fontWeight: 'bold',
                fontSize: '0.9rem'
              }}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {loading && <p>Loading devices...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      
      {!loading && !error && deviceRegistrations.length === 0 && (
        <p>No devices registered yet.</p>
      )}
      
      {deviceRegistrations.length > 0 && (
        <div>
          <p>Showing {deviceRegistrations.length} device(s)</p>
          <table className="App-table">
            <thead>
              <tr>
                <th>Device Name</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Registration Time</th>
                <th>Networks</th>
              </tr>
            </thead>
            <tbody>
              {deviceRegistrations.map((registration) => {
                const { status, color } = getDeviceStatus(registration.lastSeen);
                return (
                  <tr key={registration.deviceData.id}>
                    <td>{registration.deviceData.name}</td>
                    <td style={{ color }}>
                      <span className={`status-indicator status-${status.toLowerCase()}`}></span>
                      {status}
                    </td>
                    <td>
                      {formatDate(registration.lastSeen)}
                      <div style={{ fontSize: '0.8em', color: '#666' }}>
                        ({getTimeSince(registration.lastSeen)})
                      </div>
                    </td>
                    <td>
                      {formatDate(registration.registrationTime)}
                      <div style={{ fontSize: '0.8em', color: '#666' }}>
                        ({getTimeSince(registration.registrationTime)})
                      </div>
                    </td>
                    <td>
                      {registration.deviceData.networks?.length ? (
                        <table className="network-table">
                          <thead>
                            <tr>
                              <th>Network</th>
                              <th>IP Addresses</th>
                            </tr>
                          </thead>
                          <tbody>
                            {registration.deviceData.networks.map((network, index) => (
                              <tr key={`${registration.deviceData.id}-network-${index}`}>
                                <td>{network.name}</td>
                                <td>{network.ipAddress.join(', ')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <span>No networks</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;