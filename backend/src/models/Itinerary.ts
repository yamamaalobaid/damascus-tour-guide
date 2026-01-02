import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import User from './User';

interface ItineraryAttributes {
  id: number;
  userId: number;
  titleAr?: string;
  titleEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
  startDate: Date;
  endDate: Date;
  isPublic: boolean;
  likesCount: number;
  viewsCount: number;
  createdAt?: Date;
  updatedAt?: Date;
}

class Itinerary extends Model<ItineraryAttributes> implements ItineraryAttributes {
  public id!: number;
  public userId!: number;
  public titleAr?: string;
  public titleEn?: string;
  public descriptionAr?: string;
  public descriptionEn?: string;
  public startDate!: Date;
  public endDate!: Date;
  public isPublic!: boolean;
  public likesCount!: number;
  public viewsCount!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Itinerary.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    titleAr: {
      type: DataTypes.STRING(200),
    },
    titleEn: {
      type: DataTypes.STRING(200),
    },
    descriptionAr: {
      type: DataTypes.TEXT,
    },
    descriptionEn: {
      type: DataTypes.TEXT,
    },
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    likesCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    viewsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'Itineraries',
    timestamps: true,
  }
);

Itinerary.belongsTo(User, { foreignKey: 'userId', as: 'user' });

export default Itinerary;