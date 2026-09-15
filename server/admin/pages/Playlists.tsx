import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { csrfFetch } from '../utils/csrfFetch';
import '../styles/Playlists.css';

// Types definitions matching the required JSON structure
interface CookieEntry {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

interface PlaylistItem {
  id: string | number;
  type: string; // 'URL', 'SLEEP', 'IMAGE', 'YOUTUBE'
  data?: {
    location: string;
    muted?: boolean;
    loop?: boolean;
    loopCount?: number;
    fit?: string;       // 'contain' | 'cover' | 'fill'
    bgColor?: string;   // CSS color for background
    cookies?: CookieEntry[];
    headers?: Record<string, string | { secretId: string }>;
  };
  duration: number;
}

interface TenantSecret {
  id: string;
  name: string;
  domain?: string;
  description?: string;
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
  const [modalError, setModalError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showItemModal, setShowItemModal] = useState<boolean>(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editingItem, setEditingItem] = useState<PlaylistItem | null>(null);

  // Form states
  const [newPlaylistName, setNewPlaylistName] = useState<string>('');

  // New item states
  const [newItemType, setNewItemType] = useState<string>('URL');
  const [newItemUrl, setNewItemUrl] = useState<string>('');
  const [newItemDuration, setNewItemDuration] = useState<number>(10);
  const [newItemMuted, setNewItemMuted] = useState<boolean>(false);
  const [newItemLoop, setNewItemLoop] = useState<boolean>(false);
  const [newItemLoopCount, setNewItemLoopCount] = useState<number>(1);
  const [newItemFit, setNewItemFit] = useState<string>('contain');
  const [newItemBgColor, setNewItemBgColor] = useState<string>('#000000');
  const [newItemCookies, setNewItemCookies] = useState<CookieEntry[]>([]);
  const [newItemHeaders, setNewItemHeaders] = useState<Array<{ key: string; mode: 'plain' | 'secret'; value: string; secretId: string }>>([]);
  const [tenantSecrets, setTenantSecrets] = useState<TenantSecret[]>([]);

  // Rename playlist state
  const [showRenameModal, setShowRenameModal] = useState<boolean>(false);
  const [renamePlaylistId, setRenamePlaylistId] = useState<string | null>(null);
  const [renamePlaylistName, setRenamePlaylistName] = useState<string>('');

  // Drag reorder state
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [dragPlaylist, setDragPlaylist] = useState<string | null>(null);

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
                data: item.data,
                duration: item.duration
              }))
            }))
          };
          
          setPlaylistConfig(playlistConfig);
          // Auto-select first playlist if none selected
          if (!selectedPlaylist && playlistConfig.playlists.length > 0) {
            setSelectedPlaylist(playlistConfig.playlists[0].name);
          }
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

    const fetchSecrets = async () => {
      try {
        const tenant = currentTenant || (localStorage.getItem('currentTenant')
          ? JSON.parse(localStorage.getItem('currentTenant')!)
          : null);
        if (!tenant) return;
        const response = await fetch(`/api/tenant/${tenant.id}/secrets`);
        if (response.ok) {
          const data = await response.json();
          setTenantSecrets(data.secrets || []);
        }
      } catch {
        // Secrets fetch is best-effort — user may not be admin
      }
    };

    // Check if we have a tenant either from props or localStorage
    if (currentTenant || localStorage.getItem('currentTenant')) {
      fetchPlaylists();
      fetchSecrets();
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
        setError('No organization selected');
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


  const resetItemForm = () => {
    setNewItemType('URL');
    setNewItemUrl('');
    setNewItemDuration(10);
    setNewItemMuted(false);
    setNewItemLoop(false);
    setNewItemLoopCount(1);
    setNewItemFit('contain');
    setNewItemBgColor('#000000');
    setNewItemCookies([]);
    setNewItemHeaders([]);
    setSelectedPlaylist(null);
    setEditingItem(null);
    setModalError(null);
  };

  const handleDragStart = (playlistName: string, index: number) => {
    setDragPlaylist(playlistName);
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null) return;
    // When dragging down, the visual indicator should be below the hovered row
    // We adjust by checking if we're in the top or bottom half of the row
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const isBelow = e.clientY > midY;
    setDragOverIndex(isBelow ? index + 1 : index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
    setDragPlaylist(null);
  };

  const handleDrop = async (playlistName: string) => {
    if (dragIndex === null || dragOverIndex === null || dragPlaylist !== playlistName) {
      handleDragEnd();
      return;
    }

    const playlist = playlistConfig?.playlists.find(p => p.name === playlistName);
    if (!playlist || !playlist.id) {
      handleDragEnd();
      return;
    }

    // Calculate the actual target index after removal
    let targetIndex = dragOverIndex;
    if (targetIndex > dragIndex) targetIndex--;
    if (targetIndex === dragIndex) {
      handleDragEnd();
      return;
    }

    // Reorder items locally
    const items = [...playlist.items];
    const [moved] = items.splice(dragIndex, 1);
    items.splice(targetIndex, 0, moved);

    // Update local state immediately
    const updatedConfig = { ...playlistConfig! };
    updatedConfig.playlists = updatedConfig.playlists.map(p =>
      p.name === playlistName ? { ...p, items } : p
    );
    setPlaylistConfig(updatedConfig);
    handleDragEnd();

    // Send reorder to server
    try {
      const tenant = currentTenant || (localStorage.getItem('currentTenant')
        ? JSON.parse(localStorage.getItem('currentTenant')!)
        : null);
      if (!tenant) return;

      const itemIds = items.map(item => String(item.id));
      await csrfFetch(`/api/tenant/${tenant.id}/playlists/${playlist.id}/reorder`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds }),
      });
    } catch (err) {
      setError(`Failed to save item order: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const handleAddItem = async () => {
    if (!selectedPlaylist) {
      setModalError('No playlist selected');
      return;
    }

    if ((newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') && !newItemUrl) {
      setModalError(`URL is required for ${newItemType} type items`);
      return;
    }

    if (newItemType !== 'YOUTUBE' && newItemDuration <= 0) {
      setModalError('Duration must be greater than 0');
      return;
    }

    // Validate URL format for URL-type items
    if (newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') {
      try {
        new URL(newItemUrl);
      } catch (err) {
        setModalError(`Invalid URL format. Please enter a valid URL including http:// or https://`);
        return;
      }
    }

    // Check if YouTube video is embeddable
    if (newItemType === 'YOUTUBE') {
      try {
        const checkRes = await csrfFetch(`/api/youtube/check-embed?url=${encodeURIComponent(newItemUrl)}`);
        const checkData = await checkRes.json();
        if (!checkData.embeddable) {
          setModalError('This YouTube video cannot be embedded. It may be restricted by the uploader.');
          return;
        }
      } catch {
        // If the check fails, allow adding anyway
      }
    }

    try {
      const tenant = currentTenant || (localStorage.getItem('currentTenant')
        ? JSON.parse(localStorage.getItem('currentTenant')!) 
        : null);
      
      if (!tenant) {
        setModalError('No organization selected');
        return;
      }

      // Find the playlist to add the item to
      const playlist = playlistConfig!.playlists.find(
        p => p.name === selectedPlaylist
      );

      if (!playlist || !playlist.id) {
        setModalError('Selected playlist not found');
        return;
      }

      // Build cookies/headers for the data object
      const filteredCookies = newItemCookies.filter((c) => c.name && c.value);
      const filteredHeaders: Record<string, string | { secretId: string }> = {};
      for (const h of newItemHeaders) {
        if (!h.key) continue;
        if (h.mode === 'secret' && h.secretId) {
          filteredHeaders[h.key] = { secretId: h.secretId };
        } else if (h.mode === 'plain' && h.value) {
          filteredHeaders[h.key] = h.value;
        }
      }

      // Create new item based on type
      let newItem: any;

      if (newItemType === 'YOUTUBE') {
        const dataObj: any = { location: newItemUrl };
        if (newItemMuted) dataObj.muted = true;
        if (newItemLoop) {
          dataObj.loop = true;
          dataObj.loopCount = newItemLoopCount;
        }
        if (filteredCookies.length > 0) dataObj.cookies = filteredCookies;
        if (Object.keys(filteredHeaders).length > 0) dataObj.headers = filteredHeaders;
        newItem = {
          type: newItemType,
          data: dataObj,
          duration: 0,
        };
      } else if (newItemType === 'IMAGE') {
        const dataObj: any = { location: newItemUrl };
        if (newItemFit !== 'contain') dataObj.fit = newItemFit;
        if (newItemBgColor !== '#000000') dataObj.bgColor = newItemBgColor;
        if (filteredCookies.length > 0) dataObj.cookies = filteredCookies;
        if (Object.keys(filteredHeaders).length > 0) dataObj.headers = filteredHeaders;
        newItem = {
          type: newItemType,
          data: dataObj,
          duration: newItemDuration,
        };
      } else if (newItemType === 'URL') {
        const dataObj: any = { location: newItemUrl };
        if (filteredCookies.length > 0) dataObj.cookies = filteredCookies;
        if (Object.keys(filteredHeaders).length > 0) dataObj.headers = filteredHeaders;
        newItem = {
          type: newItemType,
          data: dataObj,
          duration: newItemDuration,
        };
      } else {
        // SLEEP type or other types
        newItem = {
          type: newItemType,
          duration: newItemDuration,
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
        resetItemForm();
        setModalError(null);
      } else {
        throw new Error(data.message || 'Failed to add item to playlist');
      }
    } catch (err) {
      setModalError(`Error adding item to playlist: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error adding item to playlist:', err);
    }
  };

  const handleRenamePlaylist = async () => {
    if (!playlistConfig || !renamePlaylistId || !renamePlaylistName.trim()) return;

    try {
      const tenant = currentTenant || (localStorage.getItem('currentTenant')
        ? JSON.parse(localStorage.getItem('currentTenant')!)
        : null);

      if (!tenant) {
        setError('No organization selected');
        return;
      }

      const response = await csrfFetch(`/api/tenant/${tenant.id}/playlists/${renamePlaylistId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renamePlaylistName.trim() }),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const updatedPlaylists = playlistConfig.playlists.map(p =>
          p.id === renamePlaylistId ? { ...p, name: renamePlaylistName.trim() } : p
        );
        setPlaylistConfig({ playlists: updatedPlaylists });
        setShowRenameModal(false);
        setRenamePlaylistId(null);
        setRenamePlaylistName('');
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to rename playlist');
      }
    } catch (err) {
      setError(`Error renaming playlist: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error renaming playlist:', err);
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
          setError('No organization selected');
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
          setError('No organization selected');
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

  const handleEditItem = (playlistName: string, item: PlaylistItem) => {
    setSelectedPlaylist(playlistName);
    setEditingItem(item);
    setNewItemType(item.type);
    setNewItemUrl(item.data?.location || '');
    setNewItemDuration(item.duration);
    setNewItemMuted(item.data?.muted || false);
    setNewItemLoop(item.data?.loop || false);
    setNewItemLoopCount(item.data?.loopCount || 1);
    setNewItemFit(item.data?.fit || 'contain');
    setNewItemBgColor(item.data?.bgColor || '#000000');
    setNewItemCookies(item.data?.cookies || []);
    setNewItemHeaders(
      item.data?.headers
        ? Object.entries(item.data.headers).map(([key, value]) => {
            if (typeof value === 'object' && value && 'secretId' in value) {
              return { key, mode: 'secret' as const, value: '', secretId: value.secretId };
            }
            return { key, mode: 'plain' as const, value: value as string, secretId: '' };
          })
        : [],
    );
    setShowItemModal(true);
  };

  const handleSaveEditItem = async () => {
    if (!selectedPlaylist || !editingItem) return;

    if ((newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') && !newItemUrl) {
      setModalError(`URL is required for ${newItemType} type items`);
      return;
    }

    if (newItemType !== 'YOUTUBE' && newItemDuration <= 0) {
      setModalError('Duration must be greater than 0');
      return;
    }

    if (newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') {
      try {
        new URL(newItemUrl);
      } catch {
        setModalError('Invalid URL format. Please enter a valid URL including http:// or https://');
        return;
      }
    }

    // Check if YouTube video is embeddable
    if (newItemType === 'YOUTUBE') {
      try {
        const checkRes = await csrfFetch(`/api/youtube/check-embed?url=${encodeURIComponent(newItemUrl)}`);
        const checkData = await checkRes.json();
        if (!checkData.embeddable) {
          setModalError('This YouTube video cannot be embedded. It may be restricted by the uploader.');
          return;
        }
      } catch {
        // If the check fails, allow saving anyway
      }
    }

    try {
      const tenant = currentTenant || (localStorage.getItem('currentTenant')
        ? JSON.parse(localStorage.getItem('currentTenant')!)
        : null);

      if (!tenant) {
        setModalError('No organization selected');
        return;
      }

      const playlist = playlistConfig!.playlists.find(p => p.name === selectedPlaylist);
      if (!playlist || !playlist.id) {
        setModalError('Playlist not found');
        return;
      }

      const editCookies = newItemCookies.filter((c) => c.name && c.value);
      const editHeaders: Record<string, string> = {};
      for (const h of newItemHeaders) {
        if (h.key && h.value) editHeaders[h.key] = h.value;
      }

      const updatedItems = playlist.items.map(item => {
        if (item.id !== editingItem!.id) return item;
        const updated: any = {
          ...item,
          type: newItemType,
          duration: newItemType === 'YOUTUBE' ? 0 : newItemDuration,
        };
        if (newItemType === 'YOUTUBE') {
          const dataObj: any = { location: newItemUrl };
          if (newItemMuted) dataObj.muted = true;
          if (newItemLoop) {
            dataObj.loop = true;
            dataObj.loopCount = newItemLoopCount;
          }
          if (editCookies.length > 0) dataObj.cookies = editCookies;
          if (Object.keys(editHeaders).length > 0) dataObj.headers = editHeaders;
          updated.data = dataObj;
        } else if (newItemType === 'IMAGE') {
          const dataObj: any = { location: newItemUrl };
          if (newItemFit !== 'contain') dataObj.fit = newItemFit;
          if (newItemBgColor !== '#000000') dataObj.bgColor = newItemBgColor;
          if (editCookies.length > 0) dataObj.cookies = editCookies;
          if (Object.keys(editHeaders).length > 0) dataObj.headers = editHeaders;
          updated.data = dataObj;
        } else if (newItemType === 'URL') {
          const dataObj: any = { location: newItemUrl };
          if (editCookies.length > 0) dataObj.cookies = editCookies;
          if (Object.keys(editHeaders).length > 0) dataObj.headers = editHeaders;
          updated.data = dataObj;
        } else {
          delete updated.data;
        }
        return updated;
      });

      const updatedPlaylist = { ...playlist, items: updatedItems };

      const response = await csrfFetch(`/api/tenant/${tenant.id}/playlists/${playlist.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedPlaylist),
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success) {
        const playlistIndex = playlistConfig!.playlists.findIndex(p => p.name === selectedPlaylist);
        const updatedConfig = JSON.parse(JSON.stringify(playlistConfig));
        updatedConfig.playlists[playlistIndex] = data.playlist;
        setPlaylistConfig(updatedConfig);
        setShowItemModal(false);
        resetItemForm();
        setModalError(null);
      } else {
        throw new Error(data.message || 'Failed to update item');
      }
    } catch (err) {
      setModalError(`Error updating item: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

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
        <div className="devices-header">
          <h1>Playlist Management</h1>
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            disabled={!currentTenant && !localStorage.getItem('currentTenant')}
          >
            Create Playlist
          </button>
        </div>

        {!currentTenant && !localStorage.getItem('currentTenant') && (
          <div className="notification-bar">
            Please select an organization from the sidebar to manage playlists.
          </div>
        )}

        {loading && <p>Loading playlists...</p>}
        {error && <p className="error-message">{error}</p>}

        {!loading && !error && (currentTenant || localStorage.getItem('currentTenant')) && !playlistConfig && (
          <div className="empty-state">
            <p>No playlist configuration found for the selected organization. Create a playlist to get started.</p>
          </div>
        )}

        {playlistConfig && (
          <div className="organizations-content">
            {/* Sidebar: playlist list */}
            <div className="organizations-sidebar">
              <h2>Playlists</h2>
              {playlistConfig.playlists.length === 0 ? (
                <p style={{ color: '#7f8c8d', fontSize: '0.9rem' }}>No playlists yet.</p>
              ) : (
                <ul className="organization-list">
                  {playlistConfig.playlists.map((playlist) => (
                    <li
                      key={playlist.name}
                      className={`organization-item ${selectedPlaylist === playlist.name ? 'active' : ''}`}
                      onClick={() => setSelectedPlaylist(playlist.name)}
                    >
                      <span className="org-icon">🎞️</span>
                      <div className="org-info">
                        <span className="org-name">{playlist.name}</span>
                        <span className="org-role">{playlist.items.length} item{playlist.items.length !== 1 ? 's' : ''}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Details: selected playlist items */}
            <div className="organization-details">
              {(() => {
                const playlist = playlistConfig.playlists.find((p) => p.name === selectedPlaylist);
                if (!playlist) {
                  return (
                    <div style={{ color: '#7f8c8d', textAlign: 'center', marginTop: '40px' }}>
                      Select a playlist from the list to view its items.
                    </div>
                  );
                }
                return (
                  <>
                    <div className="organization-header">
                      <div className="organization-title">
                        <h2>{playlist.name}</h2>
                        <span className="organization-type">
                          {playlist.items.length} item{playlist.items.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="action-buttons-cell">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => {
                            setSelectedPlaylist(playlist.name);
                            setShowItemModal(true);
                          }}
                          title="Add item"
                        >
                          + Add Item
                        </button>
                        <button
                          className="btn btn-info btn-sm"
                          onClick={() => {
                            setRenamePlaylistId(playlist.id || null);
                            setRenamePlaylistName(playlist.name);
                            setShowRenameModal(true);
                          }}
                          title="Rename playlist"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleDeletePlaylist(playlist.name)}
                          title="Delete playlist"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                        </button>
                      </div>
                    </div>

                    {playlist.items.length === 0 ? (
                      <div className="empty-items" style={{ textAlign: 'center', color: '#7f8c8d', marginTop: '20px' }}>
                        No items in this playlist. Click "+ Add Item" to add content.
                      </div>
                    ) : (
                      <table className="items-table">
                        <thead>
                          <tr>
                            <th className="drag-col"></th>
                            <th>Type</th>
                            <th>Content</th>
                            <th>Duration</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {playlist.items.map((item, index) => (
                            <tr
                              key={`${playlist.name}-${item.id}`}
                              draggable
                              onDragStart={() => handleDragStart(playlist.name, index)}
                              onDragOver={(e) => handleDragOver(e, index)}
                              onDragEnd={handleDragEnd}
                              onDrop={() => handleDrop(playlist.name)}
                              className={
                                dragPlaylist === playlist.name && dragIndex !== null
                                  ? [
                                      dragIndex === index ? 'dragging' : '',
                                      dragOverIndex === index ? 'drag-over-above' : '',
                                      dragOverIndex === index + 1 && dragOverIndex === playlist.items.length ? 'drag-over-below' : '',
                                    ].filter(Boolean).join(' ')
                                  : ''
                              }
                            >
                              <td className="drag-handle" title="Drag to reorder">
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></svg>
                              </td>
                              <td>
                                <span className="type-icon" title={item.type}>
                                  {getTypeIcon(item.type)}
                                </span>
                                {item.type}
                              </td>
                              <td>
                                {item.type === 'URL' && item.data ? (
                                  <a href={item.data.location} target="_blank" rel="noreferrer">
                                    {item.data.location.length > 40
                                      ? `${item.data.location.substring(0, 40)}...`
                                      : item.data.location}
                                  </a>
                                ) : item.type === 'IMAGE' && item.data ? (
                                  <a href={item.data.location} target="_blank" rel="noreferrer">
                                    {item.data.location.length > 40
                                      ? `${item.data.location.substring(0, 40)}...`
                                      : item.data.location}
                                  </a>
                                ) : item.type === 'YOUTUBE' && item.data ? (
                                  <a href={item.data.location} target="_blank" rel="noreferrer">
                                    {item.data.location.length > 40
                                      ? `${item.data.location.substring(0, 40)}...`
                                      : item.data.location}
                                  </a>
                                ) : item.type === 'SLEEP' ? (
                                  'Sleep mode'
                                ) : (
                                  'Content not available'
                                )}
                              </td>
                              <td>
                                {item.duration === 0 ? 'Video length' : formatDuration(item.duration)}
                                {item.data?.loop && (
                                  <span style={{ color: '#7f8c8d', fontSize: '0.8rem' }}>
                                    {' '}({item.data.loopCount || 1}x)
                                  </span>
                                )}
                                {item.data?.muted && (
                                  <span style={{ color: '#7f8c8d', fontSize: '0.8rem' }}> muted</span>
                                )}
                              </td>
                              <td className="action-buttons-cell">
                                <button
                                  className="btn btn-info btn-sm"
                                  onClick={() => handleEditItem(playlist.name, item)}
                                  title="Edit item"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleDeleteItem(playlist.name, item.id)}
                                  title="Delete item"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </>
                );
              })()}
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
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewPlaylistName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary"
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
                <h2>{editingItem ? 'Edit Item' : `Add Item to ${selectedPlaylist}`}</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowItemModal(false);
                    resetItemForm();
                    setModalError(null);
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

                {newItemType === 'IMAGE' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="item-fit">Display Mode</label>
                      <select
                        id="item-fit"
                        className="form-input"
                        value={newItemFit}
                        onChange={(e) => setNewItemFit(e.target.value)}
                      >
                        <option value="contain">Contain (fit within screen)</option>
                        <option value="cover">Cover (fill screen, may crop)</option>
                        <option value="fill">Fill (stretch to fit)</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label htmlFor="item-bg-color">Background Color</label>
                      <input
                        type="color"
                        id="item-bg-color"
                        className="form-input color-input"
                        value={newItemBgColor}
                        onChange={(e) => setNewItemBgColor(e.target.value)}
                      />
                    </div>
                  </>
                )}

                {newItemType === 'YOUTUBE' && (
                  <>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newItemMuted}
                          onChange={(e) => setNewItemMuted(e.target.checked)}
                        />
                        Muted
                      </label>
                    </div>
                    <div className="form-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={newItemLoop}
                          onChange={(e) => setNewItemLoop(e.target.checked)}
                        />
                        Loop
                      </label>
                    </div>
                    {newItemLoop && (
                      <div className="form-group">
                        <label htmlFor="item-loop-count">Number of loops</label>
                        <input
                          type="number"
                          id="item-loop-count"
                          className="form-input"
                          min="1"
                          value={newItemLoopCount}
                          onChange={(e) => setNewItemLoopCount(parseInt(e.target.value) || 1)}
                        />
                      </div>
                    )}
                  </>
                )}

                {newItemType !== 'YOUTUBE' && (
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
                )}

                {(newItemType === 'URL' || newItemType === 'IMAGE' || newItemType === 'YOUTUBE') && (
                  <>
                    <hr style={{ margin: '16px 0', borderColor: '#444' }} />
                    <h4 style={{ margin: '0 0 8px' }}>Cookies</h4>
                    <p style={{ fontSize: '0.85em', color: '#888', margin: '0 0 8px' }}>
                      Set cookies before loading this URL (e.g. to dismiss cookie banners).
                    </p>
                    {newItemCookies.map((cookie, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                        <input
                          className="form-input"
                          placeholder="Name"
                          value={cookie.name}
                          onChange={(e) => {
                            const updated = [...newItemCookies];
                            updated[idx] = { ...updated[idx], name: e.target.value };
                            setNewItemCookies(updated);
                          }}
                          style={{ flex: 1 }}
                        />
                        <input
                          className="form-input"
                          placeholder="Value"
                          value={cookie.value}
                          onChange={(e) => {
                            const updated = [...newItemCookies];
                            updated[idx] = { ...updated[idx], value: e.target.value };
                            setNewItemCookies(updated);
                          }}
                          style={{ flex: 1 }}
                        />
                        <input
                          className="form-input"
                          placeholder="Domain (optional)"
                          value={cookie.domain || ''}
                          onChange={(e) => {
                            const updated = [...newItemCookies];
                            updated[idx] = { ...updated[idx], domain: e.target.value || undefined };
                            setNewItemCookies(updated);
                          }}
                          style={{ flex: 1 }}
                        />
                        <button
                          className="btn btn-ghost"
                          onClick={() => setNewItemCookies(newItemCookies.filter((_, i) => i !== idx))}
                          style={{ padding: '4px 8px' }}
                        >
                          X
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn btn-ghost"
                      onClick={() => setNewItemCookies([...newItemCookies, { name: '', value: '' }])}
                      style={{ fontSize: '0.85em' }}
                    >
                      + Add Cookie
                    </button>

                    <h4 style={{ margin: '16px 0 8px' }}>HTTP Headers</h4>
                    <p style={{ fontSize: '0.85em', color: '#888', margin: '0 0 8px' }}>
                      Extra headers sent with every request while this item is active (e.g. Authorization).
                    </p>
                    {newItemHeaders.map((header, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <input
                          className="form-input"
                          placeholder="Header name"
                          value={header.key}
                          onChange={(e) => {
                            const updated = [...newItemHeaders];
                            updated[idx] = { ...updated[idx], key: e.target.value };
                            setNewItemHeaders(updated);
                          }}
                          style={{ flex: 1, minWidth: '120px' }}
                        />
                        <select
                          className="form-input"
                          value={header.mode === 'secret' ? header.secretId : '__plain__'}
                          onChange={(e) => {
                            const updated = [...newItemHeaders];
                            if (e.target.value === '__plain__') {
                              updated[idx] = { ...updated[idx], mode: 'plain', secretId: '' };
                            } else {
                              updated[idx] = { ...updated[idx], mode: 'secret', secretId: e.target.value, value: '' };
                            }
                            setNewItemHeaders(updated);
                          }}
                          style={{ flex: 2, minWidth: '150px' }}
                        >
                          <option value="__plain__">Custom value...</option>
                          {tenantSecrets.map((secret) => (
                            <option key={secret.id} value={secret.id}>
                              {secret.name}{secret.domain ? ` (${secret.domain})` : ''}
                            </option>
                          ))}
                        </select>
                        {header.mode === 'plain' && (
                          <input
                            className="form-input"
                            placeholder="Header value"
                            value={header.value}
                            onChange={(e) => {
                              const updated = [...newItemHeaders];
                              updated[idx] = { ...updated[idx], value: e.target.value };
                              setNewItemHeaders(updated);
                            }}
                            style={{ flex: 2, minWidth: '150px' }}
                          />
                        )}
                        <button
                          className="btn btn-ghost"
                          onClick={() => setNewItemHeaders(newItemHeaders.filter((_, i) => i !== idx))}
                          style={{ padding: '4px 8px' }}
                        >
                          X
                        </button>
                      </div>
                    ))}
                    <button
                      className="btn btn-ghost"
                      onClick={() => setNewItemHeaders([...newItemHeaders, { key: '', mode: 'plain', value: '', secretId: '' }])}
                      style={{ fontSize: '0.85em' }}
                    >
                      + Add Header
                    </button>
                  </>
                )}

                {modalError && (
                  <p className="error-message">{modalError}</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowItemModal(false);
                    resetItemForm();
                    setModalError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={editingItem ? handleSaveEditItem : handleAddItem}
                >
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        )}
        {/* Rename Playlist Modal */}
        {showRenameModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Rename Playlist</h2>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenamePlaylistId(null);
                    setRenamePlaylistName('');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="rename-playlist">Playlist Name*</label>
                  <input
                    type="text"
                    id="rename-playlist"
                    className="form-input"
                    value={renamePlaylistName}
                    onChange={(e) => setRenamePlaylistName(e.target.value)}
                  />
                </div>

                {error && (
                  <p className="error-message">{error}</p>
                )}
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowRenameModal(false);
                    setRenamePlaylistId(null);
                    setRenamePlaylistName('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleRenamePlaylist}
                  disabled={!renamePlaylistName.trim()}
                >
                  Save
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