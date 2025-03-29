import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { UserProfile } from '../types/user';
import * as userService from '../services/userService';
import { prepareRegistrationOptions, prepareRegistrationResponse, 
  arrayBufferToBase64, base64ToArrayBuffer } from '../utils/webauthn';
import '../styles/Profile.css';

interface ProfileProps {
  user: any;
  setUser: (user: any) => void;
  setIsAuthenticated: (isAuth: boolean) => void;
}

const Profile: React.FC<ProfileProps> = ({ user, setUser, setIsAuthenticated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [displayName, setDisplayName] = useState('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [passwordKeys, setPasswordKeys] = useState<any[]>([]);
  const [isAddingPasskey, setIsAddingPasskey] = useState(false);
  const [editingPasskeyId, setEditingPasskeyId] = useState<string | null>(null);
  const [newPasskeyName, setNewPasskeyName] = useState<string>('');

  useEffect(() => {
    // Initialize form with current user data
    if (user) {
      setDisplayName(user.displayName || '');
    }
    
    // Fetch additional user details
    fetchUserProfile();
  }, [user]);

  const fetchUserProfile = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch the user profile
      console.log('Fetching user profile...');
      const profileData = await userService.getUserProfile();
      console.log('Profile data received:', profileData);
      setUserProfile(profileData);
      
      try {
        // Fetch passkeys separately so profile can still load even if passkeys fail
        console.log('Fetching passkeys...');
        const passkeys = await userService.getPasskeys();
        console.log('Passkeys received:', passkeys);
        setPasswordKeys(passkeys);
      } catch (passkeysError) {
        console.error('Error fetching passkeys:', passkeysError);
        // Don't set the main error, just log it
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Update profile using service
      const result = await userService.updateProfile(displayName);
      
      setSuccess('Profile updated successfully');
      
      // Update user data in the parent component
      if (result.user) {
        setUser(result.user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error updating profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const startAddPasskey = async () => {
    setIsAddingPasskey(true);
    setError(null);
    setSuccess(null);
    
    try {
      // Step 1: Get registration options
      const optionsResponse = await fetch('/api/auth/webauthn/registration-options', {
        credentials: 'include',
      });
      
      if (!optionsResponse.ok) {
        const errorData = await optionsResponse.json();
        throw new Error(errorData.message || 'Failed to get registration options');
      }
      
      const options = await optionsResponse.json();
      console.log('Registration options received:', options);
      
      // Step 2: Prepare options for WebAuthn using our utility
      const publicKeyOptions = prepareRegistrationOptions(options);
      
      // Step 3: Use WebAuthn API to create credentials
      const credential = await navigator.credentials.create({
        publicKey: publicKeyOptions
      }) as PublicKeyCredential;
      
      // Step 4: Verify the registration using our utility
      const verifyResponse = await fetch('/api/auth/webauthn/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(prepareRegistrationResponse(credential)),
        credentials: 'include',
      });
      
      const verifyResult = await verifyResponse.json();
      
      if (verifyResult.success) {
        setSuccess('New passkey added successfully');
        // Refresh passkey list
        fetchUserProfile();
      } else {
        throw new Error(verifyResult.message || 'Failed to add passkey');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add passkey');
      console.error('Error adding passkey:', err);
    } finally {
      setIsAddingPasskey(false);
    }
  };
  
  const startEditPasskey = (passkey: any) => {
    setEditingPasskeyId(passkey.id);
    setNewPasskeyName(passkey.name);
  };
  
  const cancelEditPasskey = () => {
    setEditingPasskeyId(null);
    setNewPasskeyName('');
  };
  
  const savePasskeyName = async (passkeyId: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    
    try {
      await userService.updatePasskeyName(passkeyId, newPasskeyName);
      setSuccess('Passkey name updated successfully');
      
      // Refresh passkey list
      fetchUserProfile();
      
      // Exit edit mode
      setEditingPasskeyId(null);
      setNewPasskeyName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update passkey name');
      console.error('Error updating passkey name:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const confirmDeletePasskey = async (passkeyId: string) => {
    if (window.confirm('Are you sure you want to delete this passkey? This action cannot be undone.')) {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      try {
        await userService.deletePasskey(passkeyId);
        setSuccess('Passkey deleted successfully');
        
        // Refresh passkey list
        fetchUserProfile();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete passkey');
        console.error('Error deleting passkey:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Get logout function from props
  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="profile-container">
        <h1>Your Profile</h1>
        
        {loading && <p className="loading">Loading profile information...</p>}
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        
        <div className="profile-sections">
          <section className="profile-section">
            <h2>Account Information</h2>
            <form onSubmit={handleUpdateProfile}>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  value={user?.email || ''}
                  disabled
                  className="form-control"
                />
                <small>Email addresses cannot be changed</small>
              </div>
              
              <div className="form-group">
                <label htmlFor="displayName">Display Name</label>
                <input
                  type="text"
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="form-control"
                  required
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="role">Role</label>
                <input
                  type="text"
                  id="role"
                  value={user?.role || ''}
                  disabled
                  className="form-control"
                />
              </div>
              
              <button 
                type="submit" 
                className="primary-button"
                disabled={loading}
              >
                {loading ? 'Updating...' : 'Update Profile'}
              </button>
            </form>
          </section>
          
          <section className="profile-section">
            <h2>Security</h2>
            <h3>Your Passkeys</h3>
            
            {loading ? (
              <p>Loading passkeys...</p>
            ) : passwordKeys && passwordKeys.length > 0 ? (
              <ul className="passkeys-list">
                {passwordKeys.map((key, index) => (
                  <li key={key.id || index} className="passkey-item">
                    {editingPasskeyId === key.id ? (
                      <div className="passkey-edit">
                        <input
                          type="text"
                          value={newPasskeyName}
                          onChange={(e) => setNewPasskeyName(e.target.value)}
                          className="passkey-name-input"
                          placeholder="Passkey name"
                        />
                        <div className="passkey-edit-actions">
                          <button 
                            onClick={() => savePasskeyName(key.id)}
                            className="save-button"
                            disabled={!newPasskeyName.trim() || loading}
                          >
                            Save
                          </button>
                          <button 
                            onClick={cancelEditPasskey}
                            className="cancel-button"
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="passkey-info">
                        <div className="passkey-name-container">
                          <span className="passkey-name">
                            {key.name || `Passkey ${index + 1}`}
                          </span>
                          <div className="passkey-actions">
                            <button
                              onClick={() => startEditPasskey(key)}
                              className="edit-button"
                              title="Edit name"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => confirmDeletePasskey(key.id)}
                              className="delete-button"
                              title="Delete passkey"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <span className="passkey-date">
                          Added on {new Date(key.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-passkeys">No passkeys found. Add a new passkey for additional security.</p>
            )}
            
            <div className="passkey-actions">
              <button 
                className="primary-button"
                onClick={startAddPasskey}
                disabled={isAddingPasskey || loading}
              >
                {isAddingPasskey ? 'Adding...' : 'Add New Passkey'}
              </button>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  );
};

export default Profile;