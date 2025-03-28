export interface QuizQuestion {
  question: string;
  choices: string[];
  correctAnswer: number;
  exampleSentence?: string;
}

export interface QuizResult {
  questions: QuizQuestion[];
  score?: number;
  answeredAt?: Date;
} 