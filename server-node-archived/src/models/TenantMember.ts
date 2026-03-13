import { Table, Column, Model, DataType, ForeignKey, BelongsTo, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { User } from './User';
import { Tenant } from './Tenant';
import { generateUUID } from '../utils/helpers';
import { TenantRole, TenantMemberStatus } from '../../../shared/src/tenantData';

@Table({
  tableName: 'tenant_members',
  underscored: true,
  timestamps: true
})
export class TenantMember extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

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
  userId!: string;

  @Column({
    type: DataType.ENUM(...Object.values(TenantRole)),
    allowNull: false
  })
  role!: TenantRole;

  @Column({
    type: DataType.ENUM(...Object.values(TenantMemberStatus)),
    allowNull: false,
    defaultValue: TenantMemberStatus.PENDING
  })
  status!: TenantMemberStatus;

  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: true
  })
  invitedById?: string;

  @CreatedAt
  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'joined_at'
  })
  joinedAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @BelongsTo(() => Tenant)
  tenant?: Tenant;

  @BelongsTo(() => User, 'userId')
  user?: User;

  @BelongsTo(() => User, 'invitedById')
  invitedBy?: User;

  // Hooks
  @BeforeCreate
  static generateId(instance: TenantMember) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}