import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import ItineraryDay from './ItineraryDay';
import Place from './Place';

interface ItineraryItemAttributes {
  id: number;
  itineraryDayId: number;
  placeId: number;
  startTime?: string;
  endTime?: string;
  transportMode?: string;
  notes?: string;
  orderIndex: number;
}

class ItineraryItem extends Model<ItineraryItemAttributes> implements ItineraryItemAttributes {
  public id!: number;
  public itineraryDayId!: number;
  public placeId!: number;
  public startTime?: string;
  public endTime?: string;
  public transportMode?: string;
  public notes?: string;
  public orderIndex!: number;
}

ItineraryItem.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    itineraryDayId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    placeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    startTime: {
      type: DataTypes.TIME,
    },
    endTime: {
      type: DataTypes.TIME,
    },
    transportMode: {
      type: DataTypes.STRING(50),
      validate: {
        isIn: [['walk', 'car', 'bus', 'taxi', 'metro']],
      },
    },
    notes: {
      type: DataTypes.STRING(500),
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    tableName: 'ItineraryItems',
    timestamps: false,
  }
);

ItineraryItem.belongsTo(ItineraryDay, { foreignKey: 'itineraryDayId', as: 'day' });
ItineraryItem.belongsTo(Place, { foreignKey: 'placeId', as: 'place' });

export default ItineraryItem;