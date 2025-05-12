import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Device } from './Device';
import { Tenant } from './Tenant';
import { generateUUID } from '../utils/helpers';
import crypto from 'crypto';

@Table({
  tableName: 'device_api_keys',
  underscored: true,
  timestamps: true
})
export class DeviceApiKey extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Device)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  deviceId!: string;
  
  @ForeignKey(() => Tenant)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  tenantId?: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true
  })
  apiKey!: string;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  expiresAt?: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true
  })
  active!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW
  })
  lastUsed!: Date;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Device)
  device?: Device;
  
  @BelongsTo(() => Tenant)
  tenant?: Tenant;

  // Hooks
  @BeforeCreate
  static generateId(instance: DeviceApiKey) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
    if (!instance.apiKey) {
      // Generate a secure random API key
      instance.apiKey = crypto.randomBytes(32).toString('hex');
    }
  }

  // Check if the API key is expired
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return new Date() > this.expiresAt;
  }

  // Update last used timestamp
  updateLastUsed(): Promise<DeviceApiKey> {
    this.lastUsed = new Date();
    return this.save();
  }
}