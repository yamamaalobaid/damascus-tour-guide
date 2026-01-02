import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface PlaceAttributes {
  id: number;
  nameAr: string;
  nameEn: string;
  descriptionAr?: string;
  descriptionEn?: string;
  category: string;
  addressAr?: string;
  addressEn?: string;
   latitude?: number | null; // اسمح بـ null
  longitude?: number | null; // اسمح بـ null
  openingHours?: string;
  entryFee?: number;
  contactPhone?: string;
  contactEmail?: string;
  website?: string;
  averageRating: number;
  totalReviews: number;
  featuredImage?: string;
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

class Place extends Model<PlaceAttributes> implements PlaceAttributes {
  public id!: number;
  public nameAr!: string;
  public nameEn!: string;
  public descriptionAr?: string;
  public descriptionEn?: string;
  public category!: string;
  public addressAr?: string;
  public addressEn?: string;
public latitude?: number | null; // أضف nullable
  public longitude?: number | null; // أضف nullable
  public openingHours?: string;
  public entryFee?: number;
  public contactPhone?: string;
  public contactEmail?: string;
  public website?: string;
  public averageRating!: number;
  public totalReviews!: number;
  public featuredImage?: string;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Place.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    nameAr: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    nameEn: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    descriptionAr: {
      type: DataTypes.TEXT,
    },
    descriptionEn: {
      type: DataTypes.TEXT,
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      validate: {
        isIn: [['historic', 'restaurant', 'hotel', 'mosque', 'church', 'market', 'museum', 'park', 'cafe']],
      },
    },
    addressAr: {
      type: DataTypes.STRING(500),
    },
    addressEn: {
      type: DataTypes.STRING(500),
    },
    latitude: {
      type: DataTypes.DECIMAL(10, 8),
    },
    longitude: {
      type: DataTypes.DECIMAL(11, 8),
    },
    openingHours: {
      type: DataTypes.STRING(500),
    },
    entryFee: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    contactPhone: {
      type: DataTypes.STRING(20),
    },
    contactEmail: {
      type: DataTypes.STRING(100),
    },
    website: {
      type: DataTypes.STRING(500),
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0,
      validate: {
        min: 0,
        max: 5,
      },
    },
    totalReviews: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    featuredImage: {
      type: DataTypes.STRING(500),
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    tableName: 'Places',
    timestamps: true,
    indexes: [
      {
        fields: ['category'],
      },
      {
        fields: ['latitude', 'longitude'],
      },
      {
        fields: ['averageRating'],
      },
    ],
  }
);

export default Place;