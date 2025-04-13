import { Table, Column, Model, DataType } from 'sequelize-typescript';

@Table({ 
  tableName: 'pgmigrations',
  timestamps: false
})
export class PgMigration extends Model<PgMigration> {
  @Column({
    type: DataType.INTEGER,
    primaryKey: true,
    autoIncrement: true
  })
  id!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false
  })
  name!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false
  })
  run_on!: number;
}