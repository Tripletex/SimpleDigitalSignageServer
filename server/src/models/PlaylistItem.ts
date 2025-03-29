import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Playlist } from './Playlist';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'playlist_items',
  underscored: true,
  timestamps: true
})
export class PlaylistItem extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Playlist)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  playlistId!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  position!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  type!: string; // 'URL', 'SLEEP', etc.

  @Column({
    type: DataType.JSONB,
    allowNull: true
  })
  url?: object; // { location: string }

  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  duration!: number; // Duration in seconds

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Playlist)
  playlist?: Playlist;

  // Hooks
  @BeforeCreate
  static generateId(instance: PlaylistItem) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}