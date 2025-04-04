import mongoose, { Schema, model, models } from 'mongoose';
import { ObjectId } from 'mongodb';

// Keeping the interface for type reference
export interface IGrammar {
  userId: string | ObjectId;
  topics: string[];
  essay: string; // Changed from essays array to single essay
  grammaticalErrors: {
    category: string;
    count: number;
  }[];
  errorDetails: {
    errors: {
      type: string;
      text: string;
      startPos: number;
      endPos: number;
      explanation: string;
    }[];
  }[];
  preferredTeacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  conversation: {
    sender: 'user' | 'teacher';
    content: string;
    timestamp: Date;
  }[];
  status: 'pending' | 'processing' | 'completed' | 'failed'; // Add status field for async processing
  createdAt: Date;
  updatedAt: Date;
}

// MongoDB document type for native driver
export type GrammarDoc = {
  _id?: ObjectId;
  userId: ObjectId;
  topics: string[];
  essay: string; // Changed from essays array to single essay
  grammaticalErrors: {
    category: string;
    count: number;
  }[];
  errorDetails: {
    errors: {
      type: string;
      text: string;
      startPos: number;
      endPos: number;
      explanation: string;
    }[];
  }[];
  preferredTeacher: 'hiroshi' | 'reiko' | 'iwao' | 'taro';
  conversation: {
    sender: 'user' | 'teacher';
    content: string;
    timestamp: Date;
  }[];
  status: 'pending' | 'processing' | 'completed' | 'failed'; // Add status field for async processing
  createdAt: Date;
  updatedAt: Date;
};

// Keep the Mongoose model for backward compatibility during transition
const GrammarSchema = new Schema<IGrammar>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    topics: [{
      type: String,
      required: true,
    }],
    essay: { // Changed from essays array to single essay
      type: String,
      default: '',
    },
    grammaticalErrors: [{
      category: {
        type: String,
        required: true,
      },
      count: {
        type: Number,
        default: 1,
      }
    }],
    errorDetails: [{
      errors: [{
        type: {
          type: String,
          required: true
        },
        text: {
          type: String,
          required: true
        },
        startPos: {
          type: Number,
          required: true
        },
        endPos: {
          type: Number,
          required: true
        },
        explanation: {
          type: String,
          required: true
        }
      }]
    }],
    preferredTeacher: {
      type: String,
      enum: ['hiroshi', 'reiko', 'iwao', 'taro'],
      default: 'taro',
    },
    conversation: [{
      sender: {
        type: String,
        enum: ['user', 'teacher'],
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      timestamp: {
        type: Date,
        default: Date.now,
      },
    }],
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
GrammarSchema.index({ userId: 1 });

const Grammar = models.Grammar || model<IGrammar>('Grammar', GrammarSchema);

export default Grammar; 