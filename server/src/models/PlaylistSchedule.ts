import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { PlaylistGroup } from './PlaylistGroup';
import { Playlist } from './Playlist';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'playlist_schedules',
  underscored: true,
  timestamps: true
})
export class PlaylistSchedule extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => PlaylistGroup)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  playlistGroupId!: string;

  @ForeignKey(() => Playlist)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  playlistId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  start!: string; // Format: "HH:MM"

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  end!: string; // Format: "HH:MM"

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: false
  })
  days!: string[]; // Days of week: "mon", "tue", "wed", "thu", "fri", "sat", "sun"

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => PlaylistGroup)
  playlistGroup?: PlaylistGroup;

  @BelongsTo(() => Playlist)
  playlist?: Playlist;

  // Hooks
  @BeforeCreate
  static generateId(instance: PlaylistSchedule) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}