export interface QuizQuestion {
  question: string;
  choices: string[];
  correctAnswer: number;
}

export interface QuizResult {
  questions: QuizQuestion[];
  score?: number;
  answeredAt?: Date;
} 