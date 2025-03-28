import mongoose, { Schema, model, models } from 'mongoose';

export interface IConversation extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  teacher: 'michael' | 'emily';
  title: string;
  messages: {
    sender: 'user' | 'teacher';
    content: string;
    correctedContent?: string;
    timestamp: Date;
  }[];
  lastUpdated: Date;
  createdAt: Date;
}

const ConversationSchema = new Schema<IConversation>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    teacher: {
      type: String,
      enum: ['michael', 'emily'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      default: 'New Conversation',
    },
    messages: [
      {
        sender: {
          type: String,
          enum: ['user', 'teacher'],
          required: true,
        },
        content: {
          type: String,
          required: true,
        },
        correctedContent: {
          type: String,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Update lastUpdated field on message addition
ConversationSchema.pre('save', function (next) {
  if (this.isModified('messages')) {
    this.lastUpdated = new Date();
  }
  next();
});

const Conversation = models.Conversation || model<IConversation>('Conversation', ConversationSchema);

export default Conversation; 