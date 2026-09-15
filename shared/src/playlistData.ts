// Playlist Data Types

// Playlist Item represents a single entry in a playlist
export interface PlaylistItemData {
  id?: string; // UUID (optional when creating)
  type: string; // 'URL', 'SLEEP', etc.
  url?: {
    location: string;
  };
  duration: number; // Duration in seconds
  position?: number; // Position in playlist order
}

// Playlist represents a collection of playlist items
export interface PlaylistData {
  id?: string; // UUID (optional when creating)
  name: string;
  description?: string;
  tenantId?: string; // Required when creating, but might be implicit from request context
  items?: PlaylistItemData[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Schedule entry for when a playlist should be played
export interface PlaylistScheduleData {
  id?: string; // UUID (optional when creating)
  playlistId: string;
  start: string; // Format: "HH:MM"
  end: string; // Format: "HH:MM" 
  days: string[]; // Days of week: "mon", "tue", "wed", "thu", "fri", "sat", "sun"
}

// A group of playlists with schedules
export interface PlaylistGroupData {
  id?: string; // UUID (optional when creating)
  name: string;
  description?: string;
  tenantId?: string; // Required when creating, but might be implicit from request context
  schedules?: PlaylistScheduleData[];
  createdAt?: Date;
  updatedAt?: Date;
}

// Response types
export interface PlaylistResponse {
  success: boolean;
  message?: string;
  playlist?: PlaylistData;
}

export interface PlaylistsResponse {
  success: boolean;
  message?: string;
  playlists: PlaylistData[];
}

export interface PlaylistGroupResponse {
  success: boolean;
  message?: string;
  playlistGroup?: PlaylistGroupData;
}

export interface PlaylistGroupsResponse {
  success: boolean;
  message?: string;
  playlistGroups: PlaylistGroupData[];
}

// Combined configuration for export/import
export interface PlaylistConfig {
  playlists: PlaylistData[];
}

export interface PlaylistGroupConfig {
  groups: PlaylistGroupData[];
}

export interface CombinedConfig {
  playlists: PlaylistData[];
  groups: PlaylistGroupData[];
}