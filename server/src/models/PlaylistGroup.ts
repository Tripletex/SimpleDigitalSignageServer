import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Tenant } from './Tenant';
import { User } from './User';
import { PlaylistSchedule } from './PlaylistSchedule';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'playlist_groups',
  underscored: true,
  timestamps: true
})
export class PlaylistGroup extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  name!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  description?: string;

  @ForeignKey(() => Tenant)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  tenantId!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  createdById!: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Tenant)
  tenant?: Tenant;

  @BelongsTo(() => User, 'createdById')
  createdBy?: User;

  @HasMany(() => PlaylistSchedule)
  schedules?: PlaylistSchedule[];

  // Hooks
  @BeforeCreate
  static generateId(instance: PlaylistGroup) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}