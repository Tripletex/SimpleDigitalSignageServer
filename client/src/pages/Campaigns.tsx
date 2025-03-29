import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import '../styles/Campaigns.css';

// Types definitions for campaigns with schedules
interface PlayTime {
  id?: string;
  start: string; // Format: "HH:MM"
  end: string; // Format: "HH:MM"
  days: string[]; // Days of week: "mon", "tue", "wed", "thu", "fri", "sat", "sun"
  playlistName: string; // Reference to the playlist that should play during this time
  playlistId?: string; // Backend ID reference
}

interface Campaign {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
  playTime: PlayTime[];
}

interface CampaignsConfig {
  campaigns: Campaign[];
}

interface CampaignsProps {
  user: any;
  setIsAuthenticated: (isAuth: boolean) => void;
  setUser: (user: any) => void;
  currentTenant?: any;
}

const daysOfWeek = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' }
];

const Campaigns: React.FC<CampaignsProps> = ({ 
  user, 
  setIsAuthenticated, 
  setUser, 
  currentTenant 
}) => {
  const [campaignsConfig, setCampaignsConfig] = useState<CampaignsConfig | null>(null);
  const [playlists, setPlaylists] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showScheduleModal, setShowScheduleModal] = useState<boolean>(false);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);
  
  // Form states
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [newCampaignDescription, setNewCampaignDescription] = useState<string>('');
  
  // Schedule states
  const [newScheduleStart, setNewScheduleStart] = useState<string>('09:00');
  const [newScheduleEnd, setNewScheduleEnd] = useState<string>('17:00');
  const [newScheduleDays, setNewScheduleDays] = useState<string[]>(['mon', 'tue', 'wed', 'thu', 'fri']);
  const [newSchedulePlaylist, setNewSchedulePlaylist] = useState<string>('');
  
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

  // Fetch campaigns and playlists when component mounts or tenant changes
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        const tenant = currentTenant || (localStorage.getItem('currentTenant') 
          ? JSON.parse(localStorage.getItem('currentTenant')!) 
          : null);
        
        if (!tenant) {
          setCampaignsConfig(null);
          setPlaylists([]);
          setLoading(false);
          return;
        }
        
        // Fetch both playlist groups (campaigns) and playlists in parallel
        const [campaignsResponse, playlistsResponse] = await Promise.all([
          fetch(`/api/tenant/${tenant.id}/playlist-groups`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          }),
          fetch(`/api/tenant/${tenant.id}/playlists`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json'
            }
          })
        ]);
        
        if (!campaignsResponse.ok) {
          const errorText = await campaignsResponse.text();
          console.error('Server error response (campaigns):', errorText);
          throw new Error(`Server returned ${campaignsResponse.status}: ${campaignsResponse.statusText}`);
        }
        
        if (!playlistsResponse.ok) {
          const errorText = await playlistsResponse.text();
          console.error('Server error response (playlists):', errorText);
          throw new Error(`Server returned ${playlistsResponse.status}: ${playlistsResponse.statusText}`);
        }
        
        const campaignsData = await campaignsResponse.json();
        const playlistsData = await playlistsResponse.json();
        console.log('Server response data (campaigns):', campaignsData);
        console.log('Server response data (playlists):', playlistsData);
        
        if (campaignsData.success && playlistsData.success) {
          // Format to match our expected structure
          const campaignsConfig: CampaignsConfig = {
            campaigns: campaignsData.playlistGroups.map((campaign: any) => ({
              id: campaign.id,
              name: campaign.name,
              description: campaign.description,
              createdAt: campaign.createdAt,
              updatedAt: campaign.updatedAt,
              playTime: campaign.schedules?.map((schedule: any) => ({
                start: schedule.start,
                end: schedule.end,
                days: schedule.days,
                playlistName: playlistsData.playlists.find((p: any) => p.id === schedule.playlistId)?.name || schedule.playlistId
              })) || []
            }))
          };
          
          // Get available playlist names
          const availablePlaylists = playlistsData.playlists.map((playlist: any) => playlist.name);
          
          setCampaignsConfig(campaignsConfig);
          setPlaylists(availablePlaylists);
          setError(null);
        } else {
          throw new Error(campaignsData.message || playlistsData.message || 'Failed to fetch data');
        }
      } catch (err) {
        setError(`Error fetching data: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error fetching data:', err);
      } finally {
        setLoading(false);
      }
    };

    // Check if we have a tenant either from props or localStorage
    if (currentTenant || localStorage.getItem('currentTenant')) {
      fetchData();
    } else {
      setCampaignsConfig(null);
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

  const handleCreateCampaign = async () => {
    if (!newCampaignName.trim()) {
      setError('Campaign name is required');
      return;
    }

    // Check if campaign name already exists
    if (campaignsConfig?.campaigns.some(c => c.name === newCampaignName)) {
      setError('A campaign with this name already exists');
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
      
      // Create campaign object
      const newCampaign = {
        name: newCampaignName,
        description: newCampaignDescription || undefined,
        schedules: []
      };
      
      // Send to API
      const response = await fetch(`/api/tenant/${tenant.id}/playlist-groups`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCampaign)
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Format to match our expected structure
        const formattedCampaign = {
          id: data.playlistGroup.id,
          name: data.playlistGroup.name,
          description: data.playlistGroup.description,
          createdAt: data.playlistGroup.createdAt,
          updatedAt: data.playlistGroup.updatedAt,
          playTime: []
        };
        
        // Update state with new campaign
        const updatedConfig = { 
          ...campaignsConfig!, 
          campaigns: [...(campaignsConfig?.campaigns || []), formattedCampaign] 
        };
        
        setCampaignsConfig(updatedConfig);
        setShowCreateModal(false);
        setNewCampaignName('');
        setNewCampaignDescription('');
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to create campaign');
      }
    } catch (err) {
      setError(`Error creating campaign: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error creating campaign:', err);
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedCampaign) {
      setError('No campaign selected');
      return;
    }

    if (!newSchedulePlaylist) {
      setError('Please select a playlist');
      return;
    }

    if (!newScheduleDays.length) {
      setError('Please select at least one day');
      return;
    }

    // Simple time validation
    const startParts = newScheduleStart.split(':').map(Number);
    const endParts = newScheduleEnd.split(':').map(Number);
    
    if (startParts.length !== 2 || endParts.length !== 2 ||
        startParts.some(isNaN) || endParts.some(isNaN) ||
        startParts[0] < 0 || startParts[0] > 23 || 
        startParts[1] < 0 || startParts[1] > 59 ||
        endParts[0] < 0 || endParts[0] > 23 || 
        endParts[1] < 0 || endParts[1] > 59) {
      setError('Invalid time format. Please use HH:MM format (24-hour)');
      return;
    }
    
    // Validate start time is before end time
    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    
    if (startMinutes >= endMinutes) {
      setError('End time must be after start time');
      return;
    }
    
    // Get the currently selected campaign to check for overlap
    const currentCampaign = campaignsConfig?.campaigns.find(c => c.id === selectedCampaign);
    if (!currentCampaign) {
      setError('Selected campaign not found');
      return;
    }
    
    // Check for time overlaps on the same days
    const hasOverlap = currentCampaign.playTime.some(schedule => {
      // Check if any days overlap
      const daysOverlap = schedule.days.some(day => newScheduleDays.includes(day));
      if (!daysOverlap) return false;
      
      // Convert schedule times to minutes for comparison
      const scheduleStartParts = schedule.start.split(':').map(Number);
      const scheduleEndParts = schedule.end.split(':').map(Number);
      const scheduleStartMinutes = scheduleStartParts[0] * 60 + scheduleStartParts[1];
      const scheduleEndMinutes = scheduleEndParts[0] * 60 + scheduleEndParts[1];
      
      // Check for overlap
      // Overlap occurs if:
      // - new start time is within existing schedule, or
      // - new end time is within existing schedule, or
      // - new schedule completely encloses existing schedule
      return (
        (startMinutes >= scheduleStartMinutes && startMinutes < scheduleEndMinutes) ||
        (endMinutes > scheduleStartMinutes && endMinutes <= scheduleEndMinutes) ||
        (startMinutes <= scheduleStartMinutes && endMinutes >= scheduleEndMinutes)
      );
    });
    
    if (hasOverlap) {
      setError('This schedule overlaps with an existing schedule on the same day(s). Please adjust the times or days.');
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
      
      // Find the campaign to add the schedule to
      const campaign = campaignsConfig!.campaigns.find(
        c => c.id === selectedCampaign
      );

      if (!campaign) {
        setError('Selected campaign not found');
        return;
      }

      // Find the playlist ID from the name
      const playlistsResponse = await fetch(`/api/tenant/${tenant.id}/playlists`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!playlistsResponse.ok) {
        throw new Error(`Server returned ${playlistsResponse.status}: ${playlistsResponse.statusText}`);
      }
      
      const playlistsData = await playlistsResponse.json();
      
      if (!playlistsData.success) {
        throw new Error(playlistsData.message || 'Failed to fetch playlists');
      }
      
      const playlist = playlistsData.playlists.find((p: any) => p.name === newSchedulePlaylist);
      
      if (!playlist) {
        throw new Error(`Playlist "${newSchedulePlaylist}" not found`);
      }

      // Create schedule data to send to API
      const scheduleData = {
        playlistId: playlist.id,
        start: newScheduleStart,
        end: newScheduleEnd,
        days: [...newScheduleDays]
      };
      
      // Send to API
      const response = await fetch(`/api/tenant/${tenant.id}/playlist-groups/${selectedCampaign}/schedules`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(scheduleData)
      });
      
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        // Create a new schedule entry matching our UI structure
        const newSchedule: PlayTime = {
          start: newScheduleStart,
          end: newScheduleEnd,
          days: [...newScheduleDays],
          playlistName: newSchedulePlaylist
        };

        // Deep clone the config to avoid direct state mutation
        const updatedConfig = JSON.parse(JSON.stringify(campaignsConfig));
        const campaignIndex = updatedConfig.campaigns.findIndex((c: any) => c.id === selectedCampaign);
        updatedConfig.campaigns[campaignIndex].playTime.push(newSchedule);
        updatedConfig.campaigns[campaignIndex].updatedAt = new Date().toISOString();

        setCampaignsConfig(updatedConfig);
        setShowScheduleModal(false);
        setNewScheduleStart('09:00');
        setNewScheduleEnd('17:00');
        setNewScheduleDays(['mon', 'tue', 'wed', 'thu', 'fri']);
        setNewSchedulePlaylist('');
        setError(null);
      } else {
        throw new Error(data.message || 'Failed to add schedule');
      }
    } catch (err) {
      setError(`Error adding schedule: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error adding schedule:', err);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!campaignsConfig) return;

    if (window.confirm(`Are you sure you want to delete this campaign?`)) {
      try {
        const tenant = currentTenant || (localStorage.getItem('currentTenant') 
          ? JSON.parse(localStorage.getItem('currentTenant')!) 
          : null);
        
        if (!tenant) {
          setError('No tenant selected');
          return;
        }
        
        // Send delete request to API
        const response = await fetch(`/api/tenant/${tenant.id}/playlist-groups/${campaignId}`, {
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
          // Remove the campaign from local state
          const updatedCampaigns = campaignsConfig.campaigns.filter(
            c => c.id !== campaignId
          );
          
          setCampaignsConfig({
            campaigns: updatedCampaigns
          });
        } else {
          throw new Error(data.message || 'Failed to delete campaign');
        }
      } catch (err) {
        setError(`Error deleting campaign: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error deleting campaign:', err);
      }
    }
  };

  const handleDeleteSchedule = async (campaignId: string, scheduleIndex: number) => {
    if (!campaignsConfig) return;

    if (window.confirm('Are you sure you want to delete this schedule entry?')) {
      try {
        const tenant = currentTenant || (localStorage.getItem('currentTenant') 
          ? JSON.parse(localStorage.getItem('currentTenant')!) 
          : null);
        
        if (!tenant) {
          setError('No tenant selected');
          return;
        }
        
        // Find the campaign
        const campaignIndex = campaignsConfig.campaigns.findIndex(
          c => c.id === campaignId
        );
        
        if (campaignIndex === -1) {
          setError('Campaign not found');
          return;
        }
        
        // We need to get the actual schedule ID from backend
        const campaignResponse = await fetch(`/api/playlist-groups/${campaignId}`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        if (!campaignResponse.ok) {
          throw new Error(`Server returned ${campaignResponse.status}: ${campaignResponse.statusText}`);
        }
        
        const campaignData = await campaignResponse.json();
        
        if (!campaignData.success) {
          throw new Error(campaignData.message || 'Failed to fetch campaign details');
        }
        
        // Get the schedules from backend, which have real IDs
        if (!campaignData.playlistGroup.schedules || campaignData.playlistGroup.schedules.length <= scheduleIndex) {
          throw new Error('Schedule not found');
        }
        
        const scheduleId = campaignData.playlistGroup.schedules[scheduleIndex].id;
        
        // Send delete request to API
        const response = await fetch(`/api/tenant/${tenant.id}/playlist-groups/${campaignId}/schedules/${scheduleId}`, {
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
          // Remove the schedule entry from local state
          const updatedPlayTime = [...campaignsConfig.campaigns[campaignIndex].playTime];
          updatedPlayTime.splice(scheduleIndex, 1);
          
          // Create updated config
          const updatedConfig = JSON.parse(JSON.stringify(campaignsConfig));
          updatedConfig.campaigns[campaignIndex].playTime = updatedPlayTime;
          updatedConfig.campaigns[campaignIndex].updatedAt = new Date().toISOString();
          
          setCampaignsConfig(updatedConfig);
        } else {
          throw new Error(data.message || 'Failed to delete schedule');
        }
      } catch (err) {
        setError(`Error deleting schedule: ${err instanceof Error ? err.message : String(err)}`);
        console.error('Error deleting schedule:', err);
      }
    }
  };

  const handleExportJson = async () => {
    if (!campaignsConfig) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const tenant = currentTenant || (localStorage.getItem('currentTenant') 
        ? JSON.parse(localStorage.getItem('currentTenant')!) 
        : null);
      
      if (!tenant) {
        setError('No tenant selected');
        setLoading(false);
        return;
      }
      
      // Fetch all playlist data to include in the export
      const playlistsResponse = await fetch(`/api/tenant/${tenant.id}/playlists`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!playlistsResponse.ok) {
        throw new Error(`Server returned ${playlistsResponse.status}: ${playlistsResponse.statusText}`);
      }
      
      const playlistsData = await playlistsResponse.json();
      
      if (!playlistsData.success) {
        throw new Error(playlistsData.message || 'Failed to fetch playlists');
      }
      
      // Create a complete export with campaigns and all playlist content
      const exportData = {
        campaigns: campaignsConfig.campaigns,
        playlists: playlistsData.playlists
      };
      
      // Create a JSON string
      const jsonString = JSON.stringify(exportData, null, 2);
      
      // Create a blob and download link
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `campaigns-${currentTenant?.name || 'export'}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(`Error exporting data: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error exporting data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const tenant = currentTenant || (localStorage.getItem('currentTenant') 
        ? JSON.parse(localStorage.getItem('currentTenant')!) 
        : null);
      
      if (!tenant) {
        setError('No tenant selected');
        setLoading(false);
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const json = JSON.parse(e.target?.result as string);
          
          // Transform groups to campaigns if the old format is detected
          if (json.groups && !json.campaigns) {
            json.campaigns = json.groups;
            delete json.groups;
          }
          
          // Validate the structure
          if (!json.campaigns || !Array.isArray(json.campaigns)) {
            throw new Error('Invalid JSON structure. Must contain a campaigns array.');
          }
          
          // First, import all playlists if available
          if (json.playlists && Array.isArray(json.playlists)) {
            const importPlaylists = window.confirm(
              `This import includes ${json.playlists.length} playlists. Do you want to import them? 
              (This will replace any existing playlists with the same names)`
            );
            
            if (importPlaylists) {
              // Import each playlist
              for (const playlist of json.playlists) {
                try {
                  // Check if playlist exists
                  const existingPlaylistsResponse = await fetch(`/api/tenant/${tenant.id}/playlists`, {
                    credentials: 'include'
                  });
                  
                  if (!existingPlaylistsResponse.ok) {
                    throw new Error(`Failed to fetch existing playlists: ${existingPlaylistsResponse.status}`);
                  }
                  
                  const existingPlaylistsData = await existingPlaylistsResponse.json();
                  const existingPlaylist = existingPlaylistsData.playlists.find((p: any) => p.name === playlist.name);
                  
                  if (existingPlaylist) {
                    // Update existing playlist
                    await fetch(`/api/tenant/${tenant.id}/playlists/${existingPlaylist.id}`, {
                      method: 'PUT',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(playlist)
                    });
                  } else {
                    // Create new playlist
                    await fetch(`/api/tenant/${tenant.id}/playlists`, {
                      method: 'POST',
                      credentials: 'include',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(playlist)
                    });
                  }
                } catch (err) {
                  console.error(`Error importing playlist ${playlist.name}:`, err);
                  // Continue with next playlist
                }
              }
            }
          }
          
          // Now import campaigns by creating a new config
          const importCampaigns = window.confirm(
            `Do you want to import ${json.campaigns.length} campaigns? 
            (This will only display the campaigns in the UI. Click 'Save' on each campaign to create it in the system)`
          );
          
          if (importCampaigns) {
            setCampaignsConfig({ campaigns: json.campaigns });
          }
          
          setError(null);
          
        } catch (err) {
          setError(`Error importing JSON: ${err instanceof Error ? err.message : String(err)}`);
          console.error('Error importing JSON:', err);
        } finally {
          setLoading(false);
        }
      };
      
      reader.readAsText(file);
      
      // Reset the input
      event.target.value = '';
      
    } catch (err) {
      setError(`Error preparing import: ${err instanceof Error ? err.message : String(err)}`);
      console.error('Error preparing import:', err);
      setLoading(false);
    }
  };

  // Format days for display
  const formatDays = (days: string[]) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && 
        days.includes('mon') && 
        days.includes('tue') && 
        days.includes('wed') && 
        days.includes('thu') && 
        days.includes('fri')) {
      return 'Weekdays';
    }
    if (days.length === 2 && 
        days.includes('sat') && 
        days.includes('sun')) {
      return 'Weekends';
    }
    
    return days.map(day => {
      const dayInfo = daysOfWeek.find(d => d.value === day);
      return dayInfo ? dayInfo.label.substring(0, 3) : day;
    }).join(', ');
  };

  // Toggle day selection
  const toggleDay = (day: string) => {
    if (newScheduleDays.includes(day)) {
      setNewScheduleDays(newScheduleDays.filter(d => d !== day));
    } else {
      setNewScheduleDays([...newScheduleDays, day]);
    }
  };

  return (
    <Layout user={user} handleLogout={handleLogout}>
      <div className="campaigns-container">
        <div className="campaigns-header">
          <h1>Campaign Management</h1>
          <div className="campaigns-actions">
            <input 
              type="file" 
              id="import-json" 
              accept=".json" 
              style={{ display: 'none' }} 
              onChange={handleImportJson} 
            />
            <button 
              className="secondary-btn"
              onClick={() => document.getElementById('import-json')?.click()}
              disabled={!currentTenant && !localStorage.getItem('currentTenant')}
            >
              Import JSON
            </button>
            <button 
              className="secondary-btn"
              onClick={handleExportJson}
              disabled={!campaignsConfig}
            >
              Export JSON
            </button>
            <button 
              className="create-campaign-btn"
              onClick={() => setShowCreateModal(true)}
              disabled={!currentTenant && !localStorage.getItem('currentTenant')}
            >
              Create Campaign
            </button>
          </div>
        </div>

        {!currentTenant && !localStorage.getItem('currentTenant') && (
          <div className="notification-bar">
            Please select a tenant from the sidebar dropdown to manage campaigns.
          </div>
        )}
        
        {loading && <p>Loading campaigns...</p>}
        {error && <p className="error-message">{error}</p>}
        
        {!loading && !error && (currentTenant || localStorage.getItem('currentTenant')) && !campaignsConfig && (
          <div className="empty-state">
            <p>No campaigns found for the selected tenant. Create or import a campaign to get started.</p>
            <div className="empty-state-actions">
              <button 
                className="secondary-btn"
                onClick={() => document.getElementById('import-json')?.click()}
              >
                Import JSON
              </button>
              <button 
                className="create-campaign-btn"
                onClick={() => setShowCreateModal(true)}
              >
                Create Campaign
              </button>
            </div>
          </div>
        )}
        
        {campaignsConfig && (
          <div className="campaign-content">
            <div className="section-header">
              <h2>Campaigns</h2>
              <button 
                className="add-button"
                onClick={() => setShowCreateModal(true)}
              >
                + Add Campaign
              </button>
            </div>
            
            {campaignsConfig.campaigns.length === 0 ? (
              <div className="empty-message">No campaigns defined. Create a campaign to get started.</div>
            ) : (
              <div className="campaign-cards">
                {campaignsConfig.campaigns.map((campaign) => (
                  <div key={campaign.id} className="campaign-card">
                    <div className="campaign-card-header">
                      <h3>{campaign.name}</h3>
                      <div className="campaign-actions">
                        <button 
                          className="action-button"
                          onClick={() => {
                            setSelectedCampaign(campaign.id);
                            setShowScheduleModal(true);
                          }}
                          title="Add schedule"
                        >
                          +
                        </button>
                        <button 
                          className="action-button delete"
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          title="Delete campaign"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                    
                    {campaign.description && (
                      <div className="campaign-description">
                        {campaign.description}
                      </div>
                    )}
                    
                    <div className="campaign-schedule">
                      {campaign.playTime.length === 0 ? (
                        <div className="empty-schedule">No schedule entries defined</div>
                      ) : (
                        <table className="schedule-table">
                          <thead>
                            <tr>
                              <th>Days</th>
                              <th>Time</th>
                              <th>Playlist</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaign.playTime.map((schedule, index) => (
                              <tr key={`${campaign.id}-schedule-${index}`}>
                                <td>{formatDays(schedule.days)}</td>
                                <td>{schedule.start} - {schedule.end}</td>
                                <td>{schedule.playlistName}</td>
                                <td>
                                  <button 
                                    className="action-button delete"
                                    onClick={() => handleDeleteSchedule(campaign.id, index)}
                                    title="Delete schedule"
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
                    
                    <div className="campaign-card-footer">
                      <button 
                        className="add-schedule-btn"
                        onClick={() => {
                          setSelectedCampaign(campaign.id);
                          setShowScheduleModal(true);
                        }}
                      >
                        + Add Schedule
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        
        {/* Create Campaign Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Create New Campaign</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewCampaignName('');
                    setNewCampaignDescription('');
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="campaign-name">Campaign Name*</label>
                  <input
                    type="text"
                    id="campaign-name"
                    className="form-input"
                    placeholder="Enter campaign name"
                    value={newCampaignName}
                    onChange={(e) => setNewCampaignName(e.target.value)}
                  />
                </div>
                
                <div className="form-group">
                  <label htmlFor="campaign-description">Description (optional)</label>
                  <textarea
                    id="campaign-description"
                    className="form-input"
                    placeholder="Enter campaign description"
                    value={newCampaignDescription}
                    onChange={(e) => setNewCampaignDescription(e.target.value)}
                    rows={3}
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
                    setNewCampaignName('');
                    setNewCampaignDescription('');
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="create-button"
                  onClick={handleCreateCampaign}
                >
                  Create Campaign
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Add Schedule Modal */}
        {showScheduleModal && (
          <div className="modal-overlay">
            <div className="modal-content">
              <div className="modal-header">
                <h2>Add Schedule</h2>
                <button 
                  className="modal-close"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setNewScheduleStart('09:00');
                    setNewScheduleEnd('17:00');
                    setNewScheduleDays(['mon', 'tue', 'wed', 'thu', 'fri']);
                    setNewSchedulePlaylist('');
                    setSelectedCampaign(null);
                    setError(null);
                  }}
                >
                  ×
                </button>
              </div>
              <div className="modal-body">
                <div className="form-group">
                  <label>Days*</label>
                  <div className="days-selection">
                    {daysOfWeek.map(day => (
                      <div key={day.value} className="day-checkbox">
                        <label>
                          <input
                            type="checkbox"
                            checked={newScheduleDays.includes(day.value)}
                            onChange={() => toggleDay(day.value)}
                          />
                          {day.label.substring(0, 3)}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="form-row">
                  <div className="form-group half">
                    <label htmlFor="schedule-start">Start Time*</label>
                    <input
                      type="time"
                      id="schedule-start"
                      className="form-input"
                      value={newScheduleStart}
                      onChange={(e) => setNewScheduleStart(e.target.value)}
                    />
                  </div>
                  
                  <div className="form-group half">
                    <label htmlFor="schedule-end">End Time*</label>
                    <input
                      type="time"
                      id="schedule-end"
                      className="form-input"
                      value={newScheduleEnd}
                      onChange={(e) => setNewScheduleEnd(e.target.value)}
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="schedule-playlist">Playlist*</label>
                  <select
                    id="schedule-playlist"
                    className="form-input"
                    value={newSchedulePlaylist}
                    onChange={(e) => setNewSchedulePlaylist(e.target.value)}
                  >
                    <option value="">Select a playlist</option>
                    {playlists.map(playlist => (
                      <option key={playlist} value={playlist}>
                        {playlist}
                      </option>
                    ))}
                  </select>
                </div>
                
                {error && (
                  <p className="error-message">{error}</p>
                )}
              </div>
              <div className="modal-footer">
                <button 
                  className="cancel-button"
                  onClick={() => {
                    setShowScheduleModal(false);
                    setNewScheduleStart('09:00');
                    setNewScheduleEnd('17:00');
                    setNewScheduleDays(['mon', 'tue', 'wed', 'thu', 'fri']);
                    setNewSchedulePlaylist('');
                    setSelectedCampaign(null);
                    setError(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  className="create-button"
                  onClick={handleAddSchedule}
                >
                  Add Schedule
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Campaigns;