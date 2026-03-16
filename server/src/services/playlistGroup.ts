import playlistGroupRepository from '../repositories/playlistGroup.ts';

const playlistGroupService = {
  async getPlaylistGroupsByTenant(tenantId: string) {
    return playlistGroupRepository.getPlaylistGroupsByTenant(tenantId);
  },

  async getPlaylistGroupById(id: string) {
    return playlistGroupRepository.getPlaylistGroupById(id);
  },

  async createPlaylistGroup(data: {
    name: string;
    description?: string;
    tenantId: string;
    createdById: string;
    schedules?: Array<{
      playlistId: string;
      tenantId: string;
      start: string;
      end: string;
      days: string[];
    }>;
  }) {
    return playlistGroupRepository.createPlaylistGroup(data);
  },

  async updatePlaylistGroup(id: string, data: {
    name?: string;
    description?: string;
    schedules?: Array<{
      playlistId: string;
      tenantId: string;
      start: string;
      end: string;
      days: string[];
    }>;
  }) {
    return playlistGroupRepository.updatePlaylistGroup(id, data);
  },

  async deletePlaylistGroup(id: string) {
    return playlistGroupRepository.deletePlaylistGroup(id);
  },

  async addPlaylistSchedule(data: {
    playlistGroupId: string;
    playlistId: string;
    tenantId: string;
    start: string;
    end: string;
    days: string[];
  }) {
    return playlistGroupRepository.addPlaylistSchedule(data);
  },

  async updatePlaylistSchedule(id: string, data: Partial<{
    playlistId: string;
    start: string;
    end: string;
    days: string[];
  }>) {
    return playlistGroupRepository.updatePlaylistSchedule(id, data);
  },

  async deletePlaylistSchedule(id: string) {
    return playlistGroupRepository.deletePlaylistSchedule(id);
  },
};

export default playlistGroupService;
