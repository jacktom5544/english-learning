import mongoose, { Schema, model, models } from 'mongoose';

export interface IVocabulary extends mongoose.Document {
  word: string;
  translation: string;
  explanation: string;
  exampleSentence?: string;
  userId: mongoose.Types.ObjectId;
  isRemembered: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const VocabularySchema = new Schema<IVocabulary>(
  {
    word: {
      type: String,
      required: [true, '単語を入力してください'],
      trim: true,
    },
    translation: {
      type: String,
      required: [true, '翻訳を入力してください'],
      trim: true,
    },
    explanation: {
      type: String,
      required: [true, '説明を入力してください'],
      trim: true,
    },
    exampleSentence: {
      type: String,
      required: false,
      trim: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isRemembered: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for faster queries
VocabularySchema.index({ userId: 1, word: 1 });

const Vocabulary = models.Vocabulary || model<IVocabulary>('Vocabulary', VocabularySchema);

export default Vocabulary; 