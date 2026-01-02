import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Itinerary from './Itinerary';

interface ItineraryDayAttributes {
  id: number;
  itineraryId: number;
  dayNumber: number;
  date: Date;
  titleAr?: string;
  titleEn?: string;
  notes?: string;
}

class ItineraryDay extends Model<ItineraryDayAttributes> implements ItineraryDayAttributes {
  public id!: number;
  public itineraryId!: number;
  public dayNumber!: number;
  public date!: Date;
  public titleAr?: string;
  public titleEn?: string;
  public notes?: string;
}

ItineraryDay.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    itineraryId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    dayNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    titleAr: {
      type: DataTypes.STRING(200),
    },
    titleEn: {
      type: DataTypes.STRING(200),
    },
    notes: {
      type: DataTypes.TEXT,
    },
  },
  {
    sequelize,
    tableName: 'ItineraryDays',
    timestamps: false,
  }
);

ItineraryDay.belongsTo(Itinerary, { foreignKey: 'itineraryId', as: 'itinerary' });

export default ItineraryDay;