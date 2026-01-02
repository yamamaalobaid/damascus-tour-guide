import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';
import Chat from './Chat';

interface MessageAttributes {
  id: number;
  chatId: number;
  senderId: number;
  messageType: string;
  content: string;
  isRead: boolean;
  readAt?: Date;
  createdAt?: Date;
}

class Message extends Model<MessageAttributes> implements MessageAttributes {
  public id!: number;
  public chatId!: number;
  public senderId!: number;
  public messageType!: string;
  public content!: string;
  public isRead!: boolean;
  public readAt?: Date;
  public readonly createdAt!: Date;
}

Message.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    chatId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    senderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    messageType: {
      type: DataTypes.STRING(20),
      defaultValue: 'text',
      validate: {
        isIn: [['text', 'image', 'location', 'file']],
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    readAt: {
      type: DataTypes.DATE,
    },
  },
  {
    sequelize,
    tableName: 'Messages',
    timestamps: true,
    createdAt: 'createdAt',
    updatedAt: false,
  }
);

Message.belongsTo(Chat, { foreignKey: 'chatId', as: 'chat' });
Message.belongsTo(User, { foreignKey: 'senderId', as: 'sender' });

export default Message;