import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Device } from './Device';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'device_auth_challenges',
  underscored: true,
  timestamps: true
})
export class DeviceAuthChallenge extends Model {
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
    type: DataType.TEXT,
    allowNull: false
  })
  challenge!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false
  })
  expires!: Date;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })
  used!: boolean;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Device)
  device?: Device;

  // Hooks
  @BeforeCreate
  static generateId(instance: DeviceAuthChallenge) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}