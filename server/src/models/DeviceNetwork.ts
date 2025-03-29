import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Device } from './Device';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'device_networks',
  underscored: true,
  timestamps: true
})
export class DeviceNetwork extends Model {
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
    allowNull: false
  })
  name!: string;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: false,
    defaultValue: []
  })
  ipAddresses!: string[];

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Device)
  device?: Device;

  // Hooks
  @BeforeCreate
  static generateId(instance: DeviceNetwork) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}