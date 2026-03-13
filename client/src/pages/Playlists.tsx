import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { csrfFetch } from '../utils/csrfFetch';
import '../styles/Playlists.css';

// Types definitions matching the required JSON structure
interface PlaylistItem {
  id: string | number;
  type: string; // 'URL', 'SLEEP', 'IMAGE', 'YOUTUBE'
  url?: {
    location: string;
  };
  duration: number;
}

interface Playlist {
  id?: string;
  name: string;
  items: PlaylistItem[];
}

interface PlaylistConfig {
  playlists: Playlist[];
}

interface PlaylistsProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
  currentTenant?: any;
}

const Playlists: React.FC<PlaylistsProps> = ({ 
  user, 
  setIsAuthenticated, 
  setUser, 
  currentTenant 
}) => {
  const [playlistConfig, setPlaylistConfig] = useState<PlaylistConfig | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  
  // Form states
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  
  // New item states
  const [newItemType, setNewItemType] = useState<string>('URL');
  const [newItemUrl, setNewItemUrl] = useState<string>('');
  const [newItemDuration, setNewItemDuration] = useState<number>(10);
  
  const navigate = useNavigate();

  // Use localStorage as a backup for tenant state
  useEffect(() => {
    if (!currentTenant) {
      console.log('No currentTenant prop, checking localStorage...');
      try {
        const savedTenant = localStorage.getItem('currentTenant');
        if (savedTenant) {
          const parsedTenant = JSON.parse(savedTenant);
          console.log('Found tenant in localStorage:', parsedTenant);
          // Create a custom event to simulate tenant selection
          const event = new CustomEvent('tenantChanged', { 
            detail: parsedTenant
          });
          window.dispatchEvent(event);
        } else {
          console.log('No tenant found in localStorage');
        }
      } catch (err) {
        console.error('Error accessing localStorage:', err);
      }
    } else {
      console.log('Using currentTenant from props:', currentTenant);
    }
  }, [currentTenant]);

  // Fetch playlists when component mounts or tenant changes
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        setLoading(true);
        
        const tenant = currentTenant || (localStorage.getItem('currentTenant') 
          ? JSON.parse(localStorage.getItem('currentTenant')!) 
          : null);
        
        if (!tenant) {
          setPlaylistConfig(null);
          setLoading(false);
          return;
        }
        
        const response = await fetch(`/api/tenant/${tenant.id}/playlists`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Server error response:', errorText);
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log('Server response data:', data);
        
        if (data.success) {
          // Transform data to match our PlaylistConfig interface
          const playlistConfig: PlaylistConfig = {
            playlists: data.playlists.map((playlist: any) => ({
              id: playlist.id,
              name: playlist.name,
              items: (playlist.items || []).map((item: any) => ({
                id: item.id,
                type: item.type,
                url: item.url,
                duration: item.duration
              }))
            }))
          };
          
          setPlaylistConfig(playlistConfig);
          setError(null);
        } else {
          throw new Error(data.message || 'Failed to fetch playlists');
        }
      } catch (err) {
        setError(`Error fetching playlists: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching playlists:', err);
      } finally {
        setLoading(false);
      }
    };

    // Check if we have a tenant either from props or localStorage
    if (currentTenant || localStorage.getItem('currentTenant')) {
      fetchPlaylists();
    } else {
      setPlaylistConfig(null);
      setLoading(false);
    }
  }, [currentTenant]);

  const handleLogout = async () => {
    try {
      const response = await csrfFetch('/api/auth/logout', {
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

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      setError('Playlist name is required');
      return;
    }

    // Check if playlist name already exists
    if (playlistConfig?.playlists.some(p => p.name === newPlaylistName)) {
      setError('A playlist with this name already exists');
      return;
    }

    try {
      const tenant = currentTenant || (localStorage.getItem('currentTenant') 
        ? JSON.parse(localStorage.getItem('currentTenant')!) 
        : null);
      
      if (!tenant) {
        setError('No tenant selected');
        return;
      }
      
      // Create playlist object
      const newPlaylist = {
        name: newPlaylistName,
        items: []
      };
      
      // Send to API
      const response = await csrfFetch(`/api/tenant/${tenant.id}/playlists`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newPlaylist)
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Update local state
        const updatedConfig = { 
          ...playlistConfig!, 
          playlists: [...playlistConfig!.playlists, data.playlist] 
        };
        
        setPlaylistConfig(updatedConfig);
        setShowCreateModal(false);
        setNewPlaylistName('');
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to create playlist');
      }
    } catch (err) {
      setError(`Error creating playlist: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error creating playlist:', err);
    }
  };


  const handleAddItem = async () => {
    if (!selectedPlaylist) {
      setError('No playlist selected');
      return;
    }

    if ((newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') && !newItemUrl) {
      setError(`URL is required for ${newItemType} type items`);
      return;
    }

    if (newItemDuration <= 0) {
      setError('Duration must be greater than 0');
      return;
    }

    // Validate URL format for URL-type items
    if (newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') {
      try {
        // Test if the URL is valid by creating a URL object
        new URL(newItemUrl);
      } catch (err) {
        setError(`Invalid URL format. Please enter a valid URL including http:// or https://`);
        return;
      }
    }

    try {
      const tenant = currentTenant || (localStorage.getItem('currentTenant') 
        ? JSON.parse(localStorage.getItem('currentTenant')!) 
        : null);
      
      if (!tenant) {
        setError('No tenant selected');
        return;
      }
      
      // Find the playlist to add the item to
      const playlist = playlistConfig!.playlists.find(
        p => p.name === selectedPlaylist
      );

      if (!playlist || !playlist.id) {
        setError('Selected playlist not found');
        return;
      }

      // Create new item based on type
      let newItem: any;

      if (newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') {
        newItem = {
          type: newItemType,
          url: {
            location: newItemUrl
          },
          duration: newItemDuration
        };
      } else {
        // SLEEP type or other types
        newItem = {
          type: newItemType,
          duration: newItemDuration
        };
      }

      // Create updated playlist object with the new item
      const updatedPlaylist = {
        ...playlist,
        items: [...(playlist.items || []), newItem]
      };
      
      // Send to API
      const response = await csrfFetch(`/api/tenant/${tenant.id}/playlists/${playlist.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatedPlaylist)
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        // Update local state
        const playlistIndex = playlistConfig!.playlists.findIndex(
          p => p.name === selectedPlaylist
        );
        
        // Deep clone the playlist config to avoid direct state mutation
        const updatedConfig = JSON.parse(JSON.stringify(playlistConfig));
        updatedConfig.playlists[playlistIndex] = data.playlist;

        setPlaylistConfig(updatedConfig);
        setShowItemModal(false);
        setNewItemType('URL');
        setNewItemUrl('');
        setNewItemDuration(10);
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to add item to playlist');
      }
    } catch (err) {
      setError(`Error adding item to playlist: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error adding item to playlist:', err);
    }
  };

  const handleDeletePlaylist = async (playlistName: string) => {
    if (!playlistConfig) return;

    const playlist = playlistConfig.playlists.find(p => p.name === playlistName);
    if (!playlist || !playlist.id) {
      setError('Playlist ID not found');
      return;
    }

    if (window.confirm(`Are you sure you want to delete the playlist "${playlistName}"?`)) {
      try {
        const tenant = currentTenant || (localStorage.getItem('currentTenant') 
          ? JSON.parse(localStorage.getItem('currentTenant')!) 
          : null);
        
        if (!tenant) {
          setError('No tenant selected');
          return;
        }
        
        // Send to API
        const response = await csrfFetch(`/api/tenant/${tenant.id}/playlists/${playlist.id}`, {
          method: 'DELETE',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Update local state
          const updatedPlaylists = playlistConfig.playlists.filter(
            p => p.name !== playlistName
          );
          
          setPlaylistConfig({
            playlists: updatedPlaylists
          });
        } else {
          throw new Error(data.message || 'Failed to delete playlist');
        }
      } catch (err) {
        setError(`Error deleting playlist: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error deleting playlist:', err);
      }
    }
  };


  const handleDeleteItem = async (playlistName: string, itemId: any) => {
    if (!playlistConfig) return;

    if (window.confirm('Are you sure you want to delete this item?')) {
      try {
        const tenant = currentTenant || (localStorage.getItem('currentTenant') 
          ? JSON.parse(localStorage.getItem('currentTenant')!) 
          : null);
        
        if (!tenant) {
          setError('No tenant selected');
          return;
        }
        
        // Find the playlist
        const playlist = playlistConfig.playlists.find(
          p => p.name === playlistName
        );
        
        if (!playlist || !playlist.id) {
          setError('Playlist not found');
          return;
        }
        
        // Create an updated playlist object without the item
        const updatedItems = playlist.items?.filter(
          item => item.id !== itemId
        );
        
        const updatedPlaylist = {
          ...playlist,
          items: updatedItems
        };
        
        // Send to API
        const response = await csrfFetch(`/api/tenant/${tenant.id}/playlists/${playlist.id}`, {
          method: 'PUT',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(updatedPlaylist)
        });
        
        if (!response.ok) {
          throw new Error(`Server returned ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
          // Update local state
          const playlistIndex = playlistConfig.playlists.findIndex(
            p => p.name === playlistName
          );
          
          // Create updated config
          const updatedConfig = JSON.parse(JSON.stringify(playlistConfig));
          updatedConfig.playlists[playlistIndex] = data.playlist;
          
          setPlaylistConfig(updatedConfig);
        } else {
          throw new Error(data.message || 'Failed to delete item');
        }
      } catch (err) {
        setError(`Error deleting item: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error deleting item:', err);
      }
    }
  };

  // Export/import functionality removed - now handled in PlaylistGroups component

  // Utility to get the type icon
  const getTypeIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'URL':
        return '🌐';
      case 'IMAGE':
        return '🖼️';
      case 'VIDEO':
        return '🎬';
      case 'YOUTUBE':
        return '📺';
      case 'TEXT':
        return '📝';
      case 'SLEEP':
        return '😴';
      default:
        return '📄';
    }
  };

  // Format duration to human-readable format
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds} sec${seconds !== 1 ? 's' : ''}`;
    } else {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      if (remainingSeconds === 0) {
        return `${minutes} min${minutes !== 1 ? 's' : ''}`;
      }
      return `${minutes} min${minutes !== 1 ? 's' : ''} ${remainingSeconds} sec${remainingSeconds !== 1 ? 's' : ''}`;
    }
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="playlists-container">
        <div className="playlists-header">
          <h1>Playlist Management</h1>
          <div className="playlists-actions">
            <button 
              className="create-playlist-btn"
              onClick={() => setShowCreateModal(true)}
              disabled={!currentTenant && !localStorage.getItem('currentTenant')}
            >
              Create Playlist
            </button>
          </div>
        </div>

        {!currentTenant && !localStorage.getItem('currentTenant') && (
          <div className="notification-bar">
            Please select a tenant from the top-right dropdown to manage playlists.
          </div>
        )}
        
        {loading && <p>Loading playlists...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && (currentTenant || localStorage.getItem('currentTenant')) && !playlistConfig && (
          <div className="empty-state">
            <p>No playlist configuration found for the selected tenant. Create a playlist to get started.</p>
            <div className="empty-state-actions">
              <button 
                className="create-playlist-btn"
                onClick={() => setShowCreateModal(true)}
              >
                Create Playlist
              </button>
            </div>
          </div>
        )}
        
        {playlistConfig && (
          <div className="playlist-content">
            <div className="section">
              <div className="section-header">
                <h2>Playlists</h2>
                <button 
                  className="add-button"
                  onClick={() => setShowCreateModal(true)}
                >
                  + Add Playlist
                </button>
              </div>
              
              {playlistConfig.playlists.length === 0 ? (
                <div className="empty-message">No playlists defined. Create a playlist to get started.</div>
              ) : (
                <div className="playlist-cards">
                  {playlistConfig.playlists.map((playlist) => (
                    <div key={playlist.name} className="playlist-card">
                      <div className="playlist-card-header">
                        <h3>{playlist.name}</h3>
                        <div className="playlist-actions">
                          <button 
                            className="action-button"
                            onClick={() => {
                              setSelectedPlaylist(playlist.name);
                              setShowItemModal(true);
                            }}
                            title="Add item"
                          >
                            +
                          </button>
                          <button 
                            className="action-button delete"
                            onClick={() => handleDeletePlaylist(playlist.name)}
                            title="Delete playlist"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                      
                      <div className="playlist-items">
                        {playlist.items.length === 0 ? (
                          <div className="empty-items">No items in this playlist</div>
                        ) : (
                          <table className="items-table">
                            <thead>
                              <tr>
                                <th>Type</th>
                                <th>Content</th>
                                <th>Duration</th>
                                <th>Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {playlist.items.map((item) => (
                                <tr key={`${playlist.name}-${item.id}`}>
                                  <td>
                                    <span className="type-icon" title={item.type}>
                                      {getTypeIcon(item.type)}
                                    </span>
                                    {item.type}
                                  </td>
                                  <td>
                                    {item.type === 'URL' && item.url ? (
                                      <a href={item.url.location} target="_blank" rel="noreferrer">
                                        {item.url.location.length > 30 
                                          ? `${item.url.location.substring(0, 30)}...` 
                                          : item.url.location}
                                      </a>
                                    ) : item.type === 'IMAGE' && item.url ? (
                                      <div className="thumbnail-container">
                                        <a href={item.url.location} target="_blank" rel="noreferrer">
                                          <span className="image-label">
                                            {item.url.location.length > 30 
                                              ? `${item.url.location.substring(0, 30)}...` 
                                              : item.url.location}
                                          </span>
                                        </a>
                                      </div>
                                    ) : item.type === 'YOUTUBE' && item.url ? (
                                      <a href={item.url.location} target="_blank" rel="noreferrer">
                                        <span className="youtube-label">
                                          {item.url.location.length > 30 
                                            ? `${item.url.location.substring(0, 30)}...` 
                                            : item.url.location}
                                        </span>
                                      </a>
                                    ) : item.type === 'SLEEP' ? (
                                      'Sleep mode'
                                    ) : (
                                      'Content not available'
                                    )}
                                  </td>
                                  <td>{formatDuration(item.duration)}</td>
                                  <td>
                                    <button 
                                      className="action-button delete"
                                      onClick={() => handleDeleteItem(playlist.name, item.id)}
                                      title="Delete item"
                                    >
                                      🗑️
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                      
                      <div className="playlist-card-footer">
                        <button 
                          className="add-item-btn"
                          onClick={() => {
                            setSelectedPlaylist(playlist.name);
                            setShowItemModal(true);
                          }}
                        >
                          + Add Item
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Create Playlist Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Create New Playlist</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="playlist-name">Playlist Name*</label>
                  <input
                    type="text"
                    id="playlist-name"
                    className="form-input"
                    placeholder="Enter playlist name"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                  />
                </div>
                
                {error && (
                  <p className="error-message">{error}</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="create-button"
                  onClick={handleCreatePlaylist}
                >
                  Create Playlist
                </button>
              </div>
            </div>
          </div>
        )}
        
        
        {/* Add Item Modal */}
        {showItemModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Add Item to {selectedPlaylist}</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowItemModal(false);
                    setNewItemType('URL');
                    setNewItemUrl('');
                    setNewItemDuration(10);
                    setSelectedPlaylist(null);
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="item-type">Item Type*</label>
                  <select
                    id="item-type"
                    className="form-input"
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value)}
                  >
                    <option value="URL">URL</option>
                    <option value="IMAGE">Image (URL)</option>
                    <option value="YOUTUBE">YouTube Video/Playlist</option>
                    <option value="SLEEP">Sleep</option>
                  </select>
                </div>
                
                {(newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') && (
                  <div className="form-group">
                    <label htmlFor="item-url">
                      {newItemType === 'URL' ? 'URL*' : 
                       newItemType === 'IMAGE' ? 'Image URL*' : 
                       'YouTube URL*'}
                    </label>
                    <input
                      type="url"
                      id="item-url"
                      className="form-input"
                      placeholder={
                        newItemType === 'URL' ? 'https://example.com' : 
                        newItemType === 'IMAGE' ? 'https://example.com/image.jpg' : 
                        'https://youtube.com/watch?v=...'
                      }
                      value={newItemUrl}
                      onChange={(e) => setNewItemUrl(e.target.value)}
                    />
                    <small className="form-helper-text">
                      Enter a complete URL including http:// or https://
                    </small>
                  </div>
                )}
                
                <div className="form-group">
                  <label htmlFor="item-duration">Duration (seconds)*</label>
                  <input
                    type="number"
                    id="item-duration"
                    className="form-input"
                    min="1"
                    value={newItemDuration}
                    onChange={(e) => setNewItemDuration(parseInt(e.target.value))}
                  />
                </div>
                
                {error && (
                  <p className="error-message">{error}</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowItemModal(false);
                    setNewItemType('URL');
                    setNewItemUrl('');
                    setNewItemDuration(10);
                    setSelectedPlaylist(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="create-button"
                  onClick={handleAddItem}
                >
                  Add Item
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Playlists;