import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import moment from 'moment';
import '../styles/Devices.css';
import { DeviceRegistration } from '../services/deviceService';
import * as deviceService from '../services/deviceService';

interface DeviceProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
  currentTenant?: Tenant; // Passed from Layout component
}

interface Tenant {
  id: string;
  name: string;
  isPersonal: boolean;
  role: string;
}

const Devices: React.FC<DeviceProps> = ({ user, setIsAuthenticated, setUser, currentTenant: propCurrentTenant }) => {
  const [deviceRegistrations, setDeviceRegistrations] = useState<DeviceRegistration[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showClaimModal, setShowClaimModal] = useState<boolean>(false);
  const [deviceUuid, setDeviceUuid] = useState<string>('');
  const [deviceName, setDeviceName] = useState<string>('');
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(propCurrentTenant || null);
  const navigate = useNavigate();

  // Update currentTenant state when prop changes
  useEffect(() => {
    if (propCurrentTenant) {
      setCurrentTenant(propCurrentTenant);
    }
  }, [propCurrentTenant]);

  // Listen for tenant changes from the Layout component
  useEffect(() => {
    // Define the event handler function
    const handleTenantChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      setCurrentTenant(customEvent.detail);
    };

    // Add event listener
    window.addEventListener('tenantChanged', handleTenantChange as EventListener);
    
    // Cleanup function
    return () => {
      window.removeEventListener('tenantChanged', handleTenantChange as EventListener);
    };
  }, []);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        setLoading(true);
        
        let devices;
        if (currentTenant) {
          // Get devices for the selected tenant
          devices = await deviceService.getTenantDevices(currentTenant.id);
        } else {
          // Fallback to all devices if no tenant is selected
          devices = await deviceService.getAllDevices();
        }
        
        setDeviceRegistrations(devices);
        setError(null);
        setSuccessMessage(null);
      } catch (err) {
        setError(`Error fetching devices: ${err instanceof Error ? err.message : String(err)}`);
        setSuccessMessage(null);
        console.error('Error fetching devices:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    
    // Poll for updates every 30 seconds
    const interval = setInterval(fetchDevices, 30000);
    return () => clearInterval(interval);
  }, [currentTenant]);

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

  const handleClaimDevice = async () => {
    if (!deviceUuid.trim()) {
      setClaimError('Please enter a valid device UUID');
      return;
    }

    if (!currentTenant) {
      setClaimError('No tenant selected. Please select a tenant from the dropdown.');
      return;
    }

    try {
      // Call the API to claim the device for the current tenant
      const result = await deviceService.claimDevice(
        currentTenant.id,
        deviceUuid,
        deviceName || undefined
      );
      
      setClaimSuccess(result.message);
      setClaimError(null);
      setDeviceUuid('');
      setDeviceName('');
      
      // Close the modal after a delay
      setTimeout(() => {
        setShowClaimModal(false);
        setClaimSuccess(null);
        
        // Refresh device list
        const fetchDevices = async () => {
          try {
            // Make sure tenant still exists
            if (currentTenant && currentTenant.id) {
              const devices = await deviceService.getTenantDevices(currentTenant.id);
              setDeviceRegistrations(devices);
            } else {
              console.warn('Cannot refresh devices: tenant is undefined');
            }
          } catch (err) {
            console.error('Error refreshing devices:', err);
          }
        };
        
        fetchDevices();
      }, 2000);
      
    } catch (err) {
      setClaimError(`Error claiming device: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error claiming device:', err);
    }
  };

  const handleReleaseDevice = async (deviceId: string) => {
    if (!currentTenant) {
      setError('No tenant selected. Please select a tenant from the dropdown.');
      setSuccessMessage(null);
      return;
    }

    try {
      // Call the API to release the device
      const result = await deviceService.releaseDevice(currentTenant.id, deviceId);
      
      // Refresh the device list
      const devices = await deviceService.getTenantDevices(currentTenant.id);
      setDeviceRegistrations(devices);
      
      // Show success message
      setError(null);
      setSuccessMessage(result.message || "Device successfully released");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
    } catch (err) {
      setError(`Error releasing device: ${err instanceof Error ? err.message : String(err)}`);
      setSuccessMessage(null);
      console.error('Error releasing device:', err);
    }
  };
  
  const handleConfigureDevice = async (deviceId: string, deviceName: string) => {
    // This is a placeholder for future implementation
    // In a real implementation, this would open a configuration modal or navigate to a device configuration page
    
    if (!currentTenant) {
      setError('No tenant selected. Please select a tenant from the dropdown.');
      setSuccessMessage(null);
      return;
    }
    
    try {
      // For now, just show an alert
      setError(null);
      // Instead of an alert, show a success message
      setSuccessMessage(`Configuration for device '${deviceName}' will be implemented in a future update`);
      
      // Clear the message after 3 seconds
      setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      
      // You could also navigate to a device configuration page:
      // navigate(`/devices/${deviceId}/configure`);
      
    } catch (err) {
      setError(`Error configuring device: ${err instanceof Error ? err.message : String(err)}`);
      setSuccessMessage(null);
      console.error('Error configuring device:', err);
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

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="devices-container">
        <div className="devices-header">
          <h1>Device Management</h1>
          <button 
            className="claim-device-btn"
            onClick={() => setShowClaimModal(true)}
            disabled={!currentTenant}
          >
            Claim Device
          </button>
        </div>
        
        {!currentTenant && (
          <div className="notification-bar">
            Please select a tenant from the top-right dropdown to manage devices.
          </div>
        )}
        
        {loading && <p>Loading devices...</p>}
        {error && <p className="error-message">{error}</p>}
        {successMessage && <p className="success-message">{successMessage}</p>}
        
        {!loading && !error && deviceRegistrations.length === 0 && (
          <div className="empty-state">
            <p>No devices found for the selected tenant. Claim a device to get started.</p>
            <button 
              className="claim-device-btn"
              onClick={() => setShowClaimModal(true)}
              disabled={!currentTenant}
            >
              Claim Device
            </button>
          </div>
        )}
        
        {deviceRegistrations.length > 0 && (
          <div className="devices-grid">
            <p>Showing {deviceRegistrations.length} device(s) for {currentTenant?.name || 'Unknown Tenant'}</p>
            <div className="timestamp-note">
              <span className="timestamp-info">ⓘ</span> Relative times (like "5 minutes ago") update with each page refresh. Hover over timestamps for exact time.
            </div>
            <div className="table-responsive">
              <table className="App-table">
                <thead>
                  <tr>
                    <th>Device Name</th>
                    <th>Status</th>
                    <th>Last Seen</th>
                    <th>Registration Time</th>
                    <th>Networks</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {deviceRegistrations.map((registration) => {
                    const { status, color } = getDeviceStatus(registration.lastSeen);
                    
                    // Safely access deviceData properties with null checks
                    const displayName = registration.deviceData ? (
                      registration.deviceData.displayName || 
                      registration.deviceData.name || 
                      (registration.deviceData.id ? registration.deviceData.id.substring(0, 8) : 'Unknown')
                    ) : 'Unknown';
                    return (
                      <tr key={registration.deviceData?.id || `device-${Math.random()}`}>
                        <td>{displayName}</td>
                        <td style={{ color }}>
                          <span className={`status-indicator status-${status.toLowerCase()}`}></span>
                          {status}
                        </td>
                        <td>
                          <div title={`Exact time: ${getExactTimestamp(registration.lastSeen)}`}>
                            {formatDate(registration.lastSeen)}
                            <div style={{ fontSize: '0.8em', color: '#666' }}>
                              <span className="relative-time">({getTimeSince(registration.lastSeen)})</span>
                              <span className="timestamp-info" title="This relative time updates with each refresh">ⓘ</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div title={`Exact time: ${getExactTimestamp(registration.registrationTime)}`}>
                            {formatDate(registration.registrationTime)}
                            <div style={{ fontSize: '0.8em', color: '#666' }}>
                              <span className="relative-time">({getTimeSince(registration.registrationTime)})</span>
                              <span className="timestamp-info" title="This relative time updates with each refresh">ⓘ</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          {registration.deviceData?.networks?.length ? (
                            <table className="network-table">
                              <thead>
                                <tr>
                                  <th>Network</th>
                                  <th>IP Addresses</th>
                                </tr>
                              </thead>
                              <tbody>
                                {registration.deviceData.networks.map((network, index) => (
                                  <tr key={`${registration.deviceData?.id || 'unknown'}-network-${index}`}>
                                    <td>{network.name || 'Unknown'}</td>
                                    <td>{network.ipAddress ? network.ipAddress.join(', ') : 'No IP'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <span>No networks</span>
                          )}
                        </td>
                        <td className="action-buttons-cell">
                          <button 
                            className="action-button config"
                            onClick={() => {
                              if (registration.deviceData?.id) {
                                handleConfigureDevice(registration.deviceData.id, displayName);
                              }
                            }}
                            title="Configure Device"
                          >
                            <span className="button-icon">⚙️</span>
                            <span className="button-text">Configure</span>
                          </button>
                          
                          {registration.deviceData?.id && (
                            <button 
                              className="action-button release"
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to release device ${displayName}?`)) {
                                  handleReleaseDevice(registration.deviceData.id);
                                }
                              }}
                              title="Release Device"
                            >
                              <span className="button-icon">🔓</span>
                              <span className="button-text">Release</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Claim Device Modal */}
        {showClaimModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Claim Device for {currentTenant?.name || 'Unknown Tenant'}</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowClaimModal(false);
                    setClaimError(null);
                    setClaimSuccess(null);
                    setDeviceUuid('');
                    setDeviceName('');
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <p>Enter the device UUID to claim it:</p>
                <input
                  type="text"
                  className="device-uuid-input"
                  placeholder="Device UUID"
                  value={deviceUuid}
                  onChange={(e) => setDeviceUuid(e.target.value)}
                />
                
                <p>Optional: Give the device a friendly name:</p>
                <input
                  type="text"
                  className="device-name-input"
                  placeholder="Device Name (optional)"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                />
                
                {claimError && (
                  <p className="error-message">{claimError}</p>
                )}
                {claimSuccess && (
                  <p className="success-message">{claimSuccess}</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowClaimModal(false);
                    setClaimError(null);
                    setClaimSuccess(null);
                    setDeviceUuid('');
                    setDeviceName('');
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="claim-button"
                  onClick={handleClaimDevice}
                  disabled={!!claimSuccess}
                >
                  Claim Device
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Devices;