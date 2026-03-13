import { Table, Column, Model, DataType, ForeignKey, BelongsTo, HasMany, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Tenant } from './Tenant';
import { User } from './User';
import { PlaylistItem } from './PlaylistItem';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'playlists',
  underscored: true,
  timestamps: true
})
export class Playlist extends Model {
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

  @HasMany(() => PlaylistItem)
  items?: PlaylistItem[];

  // Hooks
  @BeforeCreate
  static generateId(instance: Playlist) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}