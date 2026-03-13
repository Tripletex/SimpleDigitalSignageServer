import playlistRepository from '../repositories/playlist.ts';

const playlistService = {
  async getPlaylistsByTenant(tenantId: string) {
    return playlistRepository.getPlaylistsByTenant(tenantId);
  },

  async getPlaylistById(id: string) {
    return playlistRepository.getPlaylistById(id);
  },

  async createPlaylist(data: {
    name: string;
    description?: string;
    tenantId: string;
    createdById: string;
    items?: Array<{
      type: string;
      url?: { location: string };
      duration: number;
    }>;
  }) {
    return playlistRepository.createPlaylist(data);
  },

  async updatePlaylist(id: string, data: {
    name?: string;
    description?: string;
    items?: Array<{
      type: string;
      url?: { location: string };
      duration: number;
    }>;
  }) {
    return playlistRepository.updatePlaylist(id, data);
  },

  async deletePlaylist(id: string) {
    return playlistRepository.deletePlaylist(id);
  },

  async addPlaylistItem(
    playlistId: string,
    tenantId: string,
    data: {
      type: string;
      url?: { location: string };
      duration: number;
    },
  ) {
    return playlistRepository.addPlaylistItem(playlistId, tenantId, data);
  },

  async updatePlaylistItem(id: string, data: Partial<{
    type: string;
    url: { location: string };
    duration: number;
    position: number;
  }>) {
    return playlistRepository.updatePlaylistItem(id, data);
  },

  async deletePlaylistItem(id: string) {
    return playlistRepository.deletePlaylistItem(id);
  },

  async reorderPlaylistItems(items: Array<{ id: string; position: number }>) {
    return playlistRepository.reorderPlaylistItems(items);
  },
};

export default playlistService;
