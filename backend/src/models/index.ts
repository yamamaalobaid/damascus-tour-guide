import sequelize from '../config/database';

// استيراد جميع النماذج
import User from './User';
import Place from './Place';
import Review from './Review';
import Favorite from './Favorite';
import Booking from './Booking';
import PlaceImage from './PlaceImage';
import Chat from './Chat';
import Message from './Message';
import Notification from './Notification';
import Itinerary from './Itinerary';
import ItineraryDay from './ItineraryDay';
import ItineraryItem from './ItineraryItem';

// تعريف العلاقات بين النماذج

// User Relations
User.hasMany(Review, { foreignKey: 'userId', as: 'reviews' });
User.hasMany(Favorite, { foreignKey: 'userId', as: 'favorites' });
User.hasMany(Booking, { foreignKey: 'userId', as: 'bookings' });
User.hasMany(PlaceImage, { foreignKey: 'uploadedBy', as: 'uploadedImages' });
User.hasMany(Chat, { foreignKey: 'userId', as: 'chats' });
User.hasMany(Message, { foreignKey: 'senderId', as: 'sentMessages' });
User.hasMany(Notification, { foreignKey: 'userId', as: 'notifications' });
User.hasMany(Itinerary, { foreignKey: 'userId', as: 'itineraries' });

// Place Relations
Place.hasMany(Review, { foreignKey: 'placeId', as: 'reviews' });
Place.hasMany(Favorite, { foreignKey: 'placeId', as: 'favorites' });
Place.hasMany(Booking, { foreignKey: 'placeId', as: 'bookings' });
Place.hasMany(PlaceImage, { foreignKey: 'placeId', as: 'images' });
Place.hasMany(ItineraryItem, { foreignKey: 'placeId', as: 'itineraryItems' });

// Itinerary Relations
Itinerary.hasMany(ItineraryDay, { foreignKey: 'itineraryId', as: 'days' });
ItineraryDay.hasMany(ItineraryItem, { foreignKey: 'itineraryDayId', as: 'items' });

// Chat Relations
Chat.hasMany(Message, { foreignKey: 'chatId', as: 'messages' });

// تصدير النماذج و sequelize
export {
  sequelize,
  User,
  Place,
  Review,
  Favorite,
  Booking,
  PlaceImage,
  Chat,
  Message,
  Notification,
  Itinerary,
  ItineraryDay,
  ItineraryItem,
};