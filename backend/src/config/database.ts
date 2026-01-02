import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'damascus_tourism',
  process.env.DB_USER || 'sa',
  process.env.DB_PASSWORD || 'YourStrongPassword123',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    dialect: 'mssql',
    dialectOptions: {
      options: {
        encrypt: true,
        trustServerCertificate: true,
        enableArithAbort: true
      }
    },
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export default sequelize;