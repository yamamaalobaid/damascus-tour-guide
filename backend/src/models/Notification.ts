import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface NotificationAttributes {
  id?: number; // اجعل id اختياريًا للإنشاء
  userId: number;
  type: string;
  titleAr: string;
  titleEn: string;
  messageAr: string;
  messageEn: string;
  data?: any;
  isRead: boolean;
  readAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

class Notification extends Model<NotificationAttributes> implements NotificationAttributes {
  public id!: number;
  public userId!: number;
  public type!: string;
  public titleAr!: string;
  public titleEn!: string;
  public messageAr!: string;
  public messageEn!: string;
  public data?: any;
  public isRead!: boolean;
  public readAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Notification.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['booking', 'review', 'message', 'alert', 'promotion', 'system']],
      },
    },
    titleAr: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    titleEn: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    messageAr: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    messageEn: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    data: {
      type: DataTypes.JSON,
      defaultValue: null,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'Notifications',
    timestamps: true,
    indexes: [
      {
        fields: ['userId'],
      },
      {
        fields: ['type'],
      },
      {
        fields: ['isRead'],
      },
      {
        fields: ['createdAt'],
      },
    ],
  }
);

export default Notification;