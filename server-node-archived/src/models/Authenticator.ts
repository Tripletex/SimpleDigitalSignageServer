import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { User } from './User';
import { generateUUID } from '../utils/helpers';

@Table({
  tableName: 'authenticators',
  underscored: true,
  timestamps: true
})
export class Authenticator extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  userId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  credentialId!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false
  })
  publicKey!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true
  })
  counter!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  deviceType!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  transports?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  fmt?: string;
  
  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  name?: string;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => User)
  user?: User;

  // Hooks
  @BeforeCreate
  static generateId(instance: Authenticator) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}