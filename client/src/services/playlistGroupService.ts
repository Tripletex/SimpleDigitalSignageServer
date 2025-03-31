// Client-side playlist group (campaign) service for interacting with APIs

interface PlaylistSchedule {
  id?: string;
  playlistId: string;
  start: string;
  end: string;
  days: string[];
}

export interface PlaylistGroup {
  id: string;
  name: string;
  description?: string;
  tenantId: string;
  createdAt: string;
  updatedAt: string;
  schedules?: PlaylistSchedule[];
}

export interface PlaylistGroupResponse {
  success: boolean;
  message: string;
  playlistGroup?: PlaylistGroup;
}

export interface PlaylistGroupsResponse {
  success: boolean;
  message: string;
  playlistGroups: PlaylistGroup[];
}

/**
 * Get all playlist groups (campaigns) for a tenant
 */
export const getPlaylistGroupsByTenant = async (tenantId: string): Promise<PlaylistGroupsResponse> => {
  const response = await fetch(`/api/tenant/${tenantId}/playlist-groups`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get playlist groups: ${response.status}`);
  }
  
  return await response.json();
};

/**
 * Get a playlist group (campaign) by ID
 */
export const getPlaylistGroupById = async (id: string): Promise<PlaylistGroupResponse> => {
  const response = await fetch(`/api/playlist-groups/${id}`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get playlist group: ${response.status}`);
  }
  
  return await response.json();
};