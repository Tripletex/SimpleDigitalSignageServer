import { Table, Column, Model, DataType, HasMany, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { User } from './User';
import { TenantMember } from './TenantMember';
import { Device } from './Device';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'tenants',
  underscored: true,
  timestamps: true
})
export class Tenant extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  name!: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })
  isPersonal!: boolean;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  ownerId!: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => User, 'ownerId')
  owner?: User;

  @HasMany(() => TenantMember)
  members?: TenantMember[];

  @HasMany(() => Device)
  devices?: Device[];

  // Hooks
  @BeforeCreate
  static generateId(instance: Tenant) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}