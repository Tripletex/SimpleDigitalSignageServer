// Import all models in a specific order to handle dependencies
import { User } from './User';
import { Authenticator } from './Authenticator';
import { EmailVerification } from './EmailVerification';
import { Tenant } from './Tenant';
import { TenantMember } from './TenantMember';
import { PendingInvitation } from './PendingInvitation';
import { Device } from './Device';
import { DeviceNetwork } from './DeviceNetwork';
import { DeviceRegistration } from './DeviceRegistration';
import { DeviceAuthChallenge } from './DeviceAuthChallenge';
import { Playlist } from './Playlist';
import { PlaylistItem } from './PlaylistItem';
import { PlaylistGroup } from './PlaylistGroup';
import { PlaylistSchedule } from './PlaylistSchedule';
import { Sequelize } from 'sequelize-typescript';

// Export all models for direct import
export {
  User,
  Authenticator,
  EmailVerification,
  Tenant,
  TenantMember,
  PendingInvitation,
  Device,
  DeviceNetwork,
  DeviceRegistration,
  DeviceAuthChallenge,
  Playlist,
  PlaylistItem,
  PlaylistGroup,
  PlaylistSchedule
};

// Array of models in order of dependency (important for initialization)
const modelArray = [
  User,
  Authenticator,
  EmailVerification,
  Tenant,
  TenantMember,
  PendingInvitation,
  Device,
  DeviceNetwork, 
  DeviceRegistration,
  DeviceAuthChallenge,
  Playlist,
  PlaylistItem,
  PlaylistGroup,
  PlaylistSchedule
];

// Define function to initialize models with a Sequelize instance
export function initModels(sequelize: Sequelize): void {
  // Add all models to Sequelize
  sequelize.addModels(modelArray);
  
  console.log('Models initialized:', modelArray.map(model => model.name).join(', '));
}

// Export model array as default for direct model loading
export default modelArray;