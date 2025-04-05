import { ObjectId } from 'mongodb';

export interface ICoachingSession {
  _id?: string | ObjectId;
  userId: string | ObjectId;
  teacher: string; // From japanese-teachers.ts (hiroshi, reiko, iwao, taro)
  title: string;
  messages: {
    _id?: string | ObjectId;
    sender: 'user' | 'teacher';
    content: string;
    timestamp: Date;
  }[];
  lastUpdated: Date;
  createdAt: Date;
}

// This is a type definition only, since we're using the MongoDB driver directly
// No Mongoose schema needed 