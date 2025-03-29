import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import '../styles/Playlists.css';

interface PlaylistItem {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  items: PlaylistEntry[];
}

interface PlaylistEntry {
  id: string;
  type: string;
  duration: number;
  content: any;
  order: number;
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
  const [playlists, setPlaylists] = useState<PlaylistItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');
  const [newPlaylistDescription, setNewPlaylistDescription] = useState<string>('');
  const navigate = useNavigate();

  // Fetch playlists when component mounts or tenant changes
  useEffect(() => {
    const fetchPlaylists = async () => {
      try {
        setLoading(true);
        
        // TODO: Replace with actual API call when implemented
        // For now, use mock data
        const mockPlaylists: PlaylistItem[] = [
          {
            id: '1',
            name: 'Default Playlist',
            description: 'A basic playlist for new displays',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            items: []
          },
          {
            id: '2',
            name: 'Welcome Lobby',
            description: 'Content for the main lobby displays',
            createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
            updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
            items: [
              {
                id: 'item1',
                type: 'image',
                duration: 10,
                content: {
                  url: 'https://placekitten.com/800/600',
                  alt: 'Welcome image'
                },
                order: 0
              },
              {
                id: 'item2',
                type: 'text',
                duration: 5,
                content: {
                  text: 'Welcome to our company!',
                  style: {
                    fontSize: '36px',
                    color: '#ffffff',
                    backgroundColor: '#3498db'
                  }
                },
                order: 1
              }
            ]
          }
        ];
        
        setPlaylists(mockPlaylists);
        setError(null);
      } catch (err) {
        setError(`Error fetching playlists: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching playlists:', err);
      } finally {
        setLoading(false);
      }
    };

    if (currentTenant) {
      fetchPlaylists();
    } else {
      setPlaylists([]);
      setLoading(false);
    }
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

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) {
      setError('Playlist name is required');
      return;
    }

    try {
      // TODO: Replace with actual API call when implemented
      const newPlaylist: PlaylistItem = {
        id: `playlist-${Date.now()}`,
        name: newPlaylistName,
        description: newPlaylistDescription || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        items: []
      };

      setPlaylists([...playlists, newPlaylist]);
      setShowCreateModal(false);
      setNewPlaylistName('');
      setNewPlaylistDescription('');
    } catch (err) {
      setError(`Error creating playlist: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error creating playlist:', err);
    }
  };

  const handleEditPlaylist = (playlistId: string) => {
    // TODO: Implement edit functionality
    console.log(`Edit playlist with ID: ${playlistId}`);
    alert('Edit functionality will be implemented shortly');
  };

  const handleDeletePlaylist = (playlistId: string) => {
    if (window.confirm('Are you sure you want to delete this playlist?')) {
      // TODO: Replace with actual API call when implemented
      setPlaylists(playlists.filter(playlist => playlist.id !== playlistId));
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getItemCount = (playlist: PlaylistItem) => {
    return playlist.items.length;
  };

  const getTotalDuration = (playlist: PlaylistItem) => {
    const totalSeconds = playlist.items.reduce((total, item) => total + item.duration, 0);
    
    if (totalSeconds < 60) {
      return `${totalSeconds} seconds`;
    } else {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      return `${minutes} min${minutes !== 1 ? 's' : ''} ${seconds} sec${seconds !== 1 ? 's' : ''}`;
    }
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="playlists-container">
        <div className="playlists-header">
          <h1>Playlist Management</h1>
          <button 
            className="create-playlist-btn"
            onClick={() => setShowCreateModal(true)}
            disabled={!currentTenant}
          >
            Create Playlist
          </button>
        </div>

        {!currentTenant && (
          <div className="notification-bar">
            Please select a tenant from the top-right dropdown to manage playlists.
          </div>
        )}
        
        {loading && <p>Loading playlists...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && currentTenant && playlists.length === 0 && (
          <div className="empty-state">
            <p>No playlists found for the selected tenant. Create a playlist to get started.</p>
            <button 
              className="create-playlist-btn"
              onClick={() => setShowCreateModal(true)}
            >
              Create Playlist
            </button>
          </div>
        )}
        
        {playlists.length > 0 && (
          <div className="playlists-grid">
            <p>Showing {playlists.length} playlist(s) for {currentTenant?.name || 'Unknown Tenant'}</p>
            
            <div className="playlist-cards">
              {playlists.map(playlist => (
                <div key={playlist.id} className="playlist-card">
                  <div className="playlist-card-header">
                    <h3>{playlist.name}</h3>
                    <div className="playlist-actions">
                      <button 
                        className="action-button edit"
                        onClick={() => handleEditPlaylist(playlist.id)}
                      >
                        Edit
                      </button>
                      <button 
                        className="action-button delete"
                        onClick={() => handleDeletePlaylist(playlist.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  
                  <div className="playlist-card-content">
                    {playlist.description && (
                      <p className="playlist-description">{playlist.description}</p>
                    )}
                    
                    <div className="playlist-meta">
                      <div className="meta-item">
                        <span className="meta-label">Items:</span>
                        <span className="meta-value">{getItemCount(playlist)}</span>
                      </div>
                      
                      <div className="meta-item">
                        <span className="meta-label">Duration:</span>
                        <span className="meta-value">{getTotalDuration(playlist)}</span>
                      </div>
                      
                      <div className="meta-item">
                        <span className="meta-label">Created:</span>
                        <span className="meta-value">{formatDate(playlist.createdAt)}</span>
                      </div>
                      
                      <div className="meta-item">
                        <span className="meta-label">Updated:</span>
                        <span className="meta-value">{formatDate(playlist.updatedAt)}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="playlist-preview">
                    {playlist.items.length > 0 ? (
                      <div className="preview-items">
                        {playlist.items.slice(0, 3).map((item, index) => (
                          <div key={item.id} className="preview-item">
                            <div className="item-type-badge">{item.type}</div>
                            {item.type === 'image' && (
                              <div className="preview-image">
                                <img src={item.content.url} alt={item.content.alt || 'Playlist item'} />
                              </div>
                            )}
                            {item.type === 'text' && (
                              <div className="preview-text">
                                <span>{item.content.text.substring(0, 30)}{item.content.text.length > 30 ? '...' : ''}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {playlist.items.length > 3 && (
                          <div className="preview-more">+{playlist.items.length - 3} more</div>
                        )}
                      </div>
                    ) : (
                      <div className="empty-preview">No items in this playlist</div>
                    )}
                  </div>
                </div>
              ))}
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
                    setNewPlaylistDescription('');
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
                
                <div className="form-group">
                  <label htmlFor="playlist-description">Description (optional)</label>
                  <textarea
                    id="playlist-description"
                    className="form-textarea"
                    placeholder="Enter a description for this playlist"
                    value={newPlaylistDescription}
                    onChange={(e) => setNewPlaylistDescription(e.target.value)}
                  ></textarea>
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
                    setNewPlaylistDescription('');
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
      </div>
    </Layout>
  );
};

export default Playlists;