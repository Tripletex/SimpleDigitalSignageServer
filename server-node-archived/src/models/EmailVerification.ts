import { Table, Column, Model, DataType, PrimaryKey, CreatedAt, BeforeCreate } from 'sequelize-typescript';
import { generateUUID } from '../utils/helpers';
import crypto from 'crypto';

@Table({
  tableName: 'email_verifications',
  underscored: true,
  timestamps: true
})
export class EmailVerification extends Model {
  @PrimaryKey
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  token!: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false
  })
  isFirstUser!: boolean;
  
  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  invitingTenantId?: string;
  
  @Column({
    type: DataType.STRING,
    allowNull: true
  })
  invitedRole?: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: () => {
      // Set expiration date to 24 hours from now
      const date = new Date();
      date.setHours(date.getHours() + 24);
      return date;
    }
  })
  expiresAt!: Date;

  @CreatedAt
  createdAt!: Date;

  // Generate a random token
  static generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // Hooks
  @BeforeCreate
  static generateId(instance: EmailVerification) {
    if (!instance.id) {
      instance.id = generateUUID();
    }
    if (!instance.token) {
      instance.token = EmailVerification.generateToken();
    }
  }
}