import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { User } from './User';
import { Tenant } from './Tenant';
import { DeviceNetwork } from './DeviceNetwork';
import { DeviceRegistration } from './DeviceRegistration';
import { PlaylistGroup } from './PlaylistGroup';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'devices',
  underscored: true,
  timestamps: true
})
export class Device extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  name!: string;

  @ForeignKey(() => Tenant)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  tenantId?: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  claimedById?: string;

  @Column({
    type: DataType.DATE,
    allowNull: true
  })
  claimedAt?: Date;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  displayName?: string;
  
  @ForeignKey(() => PlaylistGroup)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  campaignId?: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Tenant)
  tenant?: Tenant;

  @BelongsTo(() => User, 'claimedById')
  claimedBy?: User;
  
  @BelongsTo(() => PlaylistGroup, 'campaignId')
  campaign?: PlaylistGroup;

  @HasMany(() => DeviceNetwork)
  networks?: DeviceNetwork[];

  @HasMany(() => DeviceRegistration)
  registrations?: DeviceRegistration[];

  // Hooks
  @BeforeCreate
  static generateId(instance: Device) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}