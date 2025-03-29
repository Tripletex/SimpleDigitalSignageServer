import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Device } from './Device';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'device_registrations',
  underscored: true,
  timestamps: true
})
export class DeviceRegistration extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Device)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  deviceId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  deviceType?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  hardwareId?: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW
  })
  registrationTime!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW
  })
  lastSeen!: Date;
  
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true
  })
  active!: boolean;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Device)
  device?: Device;

  // Hooks
  @BeforeCreate
  static generateId(instance: DeviceRegistration) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}