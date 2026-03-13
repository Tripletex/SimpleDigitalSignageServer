import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { User } from './User';
import { Tenant } from './Tenant';
import { generateUUID } from '../utils/helpers';
import { TenantRole } from '../../../shared/src/tenantData';

@Table({
  tableName: 'pending_invitations',
  underscored: true,
  timestamps: true
})
export class PendingInvitation extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @ForeignKey(() => Tenant)
  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  tenantId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  })
  email!: string;

  @Column({
    type: DataType.ENUM(...Object.values(TenantRole)),
    allowNull: false
  })
  role!: TenantRole;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  invitedById?: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: () => {
      // Set expiration date to 14 days from now
      const date = new Date();
      date.setDate(date.getDate() + 14);
      return date;
    }
  })
  expiresAt!: Date;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'created_at'
  })
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Tenant)
  tenant?: Tenant;

  @BelongsTo(() => User, 'invitedById')
  invitedBy?: User;

  // Hooks
  @BeforeCreate
  static generateId(instance: PendingInvitation) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}