import { Table, Column, Model, DataType, HasMany, PrimaryKey, CreatedAt, UpdatedAt, BeforeCreate } from 'sequelize-typescript';
import { Authenticator } from './Authenticator';
import { generateUUID } from '../utils/helpers';
import { UserRole } from '../../../shared/src/userData';

@Table({
  tableName: 'users',
  underscored: true,
  timestamps: true
})
export class User extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  displayName?: string;

  @Column({
    type: DataType.ENUM(...Object.values(UserRole)),
    allowNull: false,
    defaultValue: UserRole.USER
  })
  role!: UserRole;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;

  // Relationships
  @HasMany(() => Authenticator)
  authenticators?: Authenticator[];
  
  // This is referenced in the controller but defined via the TenantMember model
  // Add it to the type for clarity
  tenantMemberships?: any[];

  // Hooks
  @BeforeCreate
  static generateId(instance: User) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
  }
}