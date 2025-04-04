import OpenAI from 'openai';
import { JapaneseTeacherKey } from './japanese-teachers'; 

import deepseek from './deepseek';
import 'server-only';
// Remove unused TeacherType import
// import { TeacherType } from './teachers';

// Define the role type to match OpenAI's expectations
type MessageRole = 'system' | 'user' | 'assistant';

export type AIMessage = {
  role: MessageRole;
  content: string;
};

export type AICompletionOptions = {
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
};

/**
 * Generate a response from DeepSeek AI
 * @param messages - The conversation history
 * @param options - Options for the completion
 * @returns The AI-generated response
 */
export async function generateAIResponse(
  messages: AIMessage[],
  options: AICompletionOptions = {}
): Promise<string> {
  const { 
    maxTokens = 500, 
    temperature = 0.7,
    systemPrompt = 'You are a helpful assistant specialized in English language learning for Japanese users. Keep responses clear and concise.'
  } = options;

  // Ensure there's a system message at the beginning if not already present
  const formattedMessages = messages[0]?.role === 'system' 
    ? messages 
    : [{ role: 'system' as MessageRole, content: systemPrompt }, ...messages];

  try {
    console.log('Sending request to DeepSeek API...');
    
    if (!deepseek || !deepseek.chat || !deepseek.chat.completions) {
      console.error('DeepSeek API client is not properly initialized');
      throw new Error('AI APIクライアントの初期化エラー');
    }
    
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat', // Always use deepseek-chat, not the more expensive reasoner
      messages: formattedMessages as any, // Type assertion to avoid type conflicts
      max_tokens: maxTokens,
      temperature: temperature,
    });

    if (!response || !response.choices || response.choices.length === 0 || !response.choices[0].message) {
      console.error('DeepSeek API returned an invalid response:', response);
      throw new Error('無効なAIレスポンスを受け取りました');
    }

    return response.choices[0].message.content || '';
  } catch (error: any) {
    console.error('DeepSeek AI error:', error);
    
    // Check if it's a timeout error
    if (error.message && error.message.includes('timeout')) {
      throw new Error('AIリクエストがタイムアウトしました。しばらくしてからもう一度お試しください。');
    }
    
    // Check if it's an API key error
    if (error.message && error.message.includes('api_key')) {
      throw new Error('API認証エラー。管理者にお問い合わせください。');
    }
    
    throw new Error(`AIリクエストエラー: ${error.message || '不明なエラー'}`);
  }
}

/**
 * Generate an English quiz based on a topic/level
 * @param topic - Quiz topic
 * @param level - Difficulty level (beginner, intermediate, advanced)
 * @param count - Number of quiz questions to generate (default 10, max 20)
 * @param excludeWords - Array of words to exclude from the generated quiz
 * @returns The generated quiz
 */
export async function generateEnglishQuiz(
  topic: string, 
  level: string, 
  count: number = 10, 
  excludeWords: string[] = []
) {
  // Ensure count is within reasonable limits
  const questionCount = Math.min(Math.max(count, 1), 10);
  
  // Format the exclude words for the prompt
  const excludeWordsText = excludeWords.length > 0
    ? `\n除外する単語リスト: ${excludeWords.slice(0, 100).join(', ')}${excludeWords.length > 100 ? '...(その他)' : ''}`
    : '';
  
  const prompt = `
    制作条件: 
    
    - レベル: ${level}
    - 問題数: ${questionCount}問（全て異なる英単語を使用すること）
    - 言語: 日本語と英語を併記${excludeWordsText}
    
    以下の形式で英語クイズを作成してください:
    
    まず、ユーザーの英語レベルに合った${questionCount}個の英単語とその意味を考えてください。
    それぞれの単語は異なる単語である必要があります。
    
    そして、各単語について以下の形式でクイズを作成してください:
    
    [
      {
        "question": "英単語そのもの（例："Patient"）",
        "choices": ["選択肢1（日本語）", "選択肢2（日本語）", "選択肢3（日本語）", "選択肢4（日本語）", "選択肢5（日本語）"],
        "correctIndex": 0～4のいずれか（正解の選択肢のインデックス）,
        "explanation": "この単語の説明や使い方（日本語）",
        "exampleSentence": "この単語を使った英語の例文"
      },
      ...残りの単語も同様の形式で...
    ]
    
    重要：
    1. 必ず${questionCount}問の異なる問題を作成してください
    2. JSONフォーマットで出力してください
    3. questionに英単語、choicesに日本語の単語（5つ）を含めてください
    4. correctIndexは必ず0から4の整数値で、choicesの正解のインデックスにしてください
    5. 選択肢は必ず5つ用意してください
    6. 除外リストにある単語は使用しないでください
    7. exampleSentenceフィールドには、その英単語を実際に使った英語の例文を含めてください。例文は簡潔でわかりやすく、日常的に使える文章にしてください。
    8. correctIndexが偏らないようにしてください。（例えば、正解が0の問題が多いとか、正解が4の問題が多いとか）
  `;

  try {
    const response = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 2000,
      temperature: 0.7,
      systemPrompt: 'あなたは英語教育の専門家です。日本人学習者向けに、わかりやすく役立つ英語学習コンテンツを作成してください。JSONフォーマットで正確な出力を行います。'
    });
    
    // Extract JSON from the response
    const jsonMatch = response.match(/\[\s*{[\s\S]*}\s*\]/);
    if (jsonMatch) {
      try {
        const jsonData = JSON.parse(jsonMatch[0]);
        // Validate the JSON structure
        if (Array.isArray(jsonData) && jsonData.length > 0) {
          const isValid = jsonData.every(item => 
            typeof item.question === 'string' && 
            Array.isArray(item.choices) && 
            item.choices.length === 5 &&
            typeof item.correctIndex === 'number' && 
            item.correctIndex >= 0 && 
            item.correctIndex <= 4 &&
            typeof item.explanation === 'string' &&
            typeof item.exampleSentence === 'string'
          );
          
          if (isValid) {
            return JSON.stringify(jsonData);
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON from AI response:', e);
      }
    }
    
    // If we couldn't extract valid JSON, return the full response
    return response;
  } catch (error: any) {
    console.error('Error generating quiz:', error);
    return 'クイズの生成に失敗しました。後でもう一度お試しください。';
  }
}

/**
 * Provide feedback on a student's English writing, adopting a specific Japanese teacher persona.
 * @param topic - The assigned writing topic.
 * @param text - The student's text to analyze.
 * @param teacherKey - The key identifying the Japanese teacher persona.
 * @param personaPrompt - The specific system prompt defining the teacher's persona and feedback style.
 * @returns Detailed feedback string (no score).
 */
export async function provideWritingFeedback(
  topic: string,
  text: string,
  teacherKey: JapaneseTeacherKey, // Use JapaneseTeacherKey
  personaPrompt: string // Add personaPrompt parameter
): Promise<string> {
  
  // The personaPrompt received as argument defines the teacher's characteristics.
  // Use it directly as the system prompt.
  const systemPrompt = personaPrompt;

  const userPrompt = `
    Please act as the English teacher defined by the system prompt.
    A student has written the following text based on the topic provided.

    Topic: \"${topic}\"
    Student's Writing:
    \"${text}\"

    Your task is to provide comprehensive feedback **in Japanese**. Follow these instructions precisely:
    1. Relevance Check: First, evaluate if the student's writing is relevant to the given topic. If it is clearly off-topic or only slightly related, mention this kindly in your feedback (**Japanese**) *before* addressing other points.
    2. Detailed Feedback: Provide specific feedback **in Japanese** on grammar, vocabulary usage, spelling, sentence structure, and overall clarity. Offer concrete examples for correction and explain *briefly* **in Japanese** why the changes are suggested.
    3. Tone: Maintain the persona and tone described in the system prompt throughout your feedback (e.g., if the persona prompt specifies Kansai dialect, use it, but provide feedback in Japanese).
    4. NO SCORE: Do NOT include any numerical score, points, or grade.
    5. Concluding Remark: End with an encouraging closing statement **in Japanese**, suitable for the teacher's persona.

    Structure your feedback clearly **in Japanese**.
  `;

  try {
    // Update console log to use JapaneseTeacherKey
    console.log(`Generating writing feedback as Japanese teacher: ${teacherKey} (in Japanese)`);
    const feedbackText = await generateAIResponse(
        [{ role: 'user', content: userPrompt }], 
        {
          maxTokens: 1000, 
          temperature: 0.6,
          systemPrompt: systemPrompt // Use the passed personaPrompt here
        }
    );
    
    return feedbackText || "フィードバックの生成に失敗しました。"; 

  } catch (error) {
    console.error(`Error generating writing feedback for Japanese teacher ${teacherKey}:`, error);
    return "フィードバックの生成中にエラーが発生しました。"; 
  }
}

/**
 * Generate vocabulary practice content
 * @param topic - Vocabulary topic or theme
 * @param count - Number of vocabulary items to generate
 * @returns Vocabulary practice content
 */
export async function generateVocabularyPractice(topic: string, count: number = 10) {
  const prompt = `
    以下の条件で英単語学習用のコンテンツを作成してください:
    
    - トピック: ${topic}
    - 単語数: ${count}個
    
    各単語について以下の情報を含めてください:
    1. 英単語
    2. 発音記号
    3. 日本語の意味
    4. 品詞
    5. 例文 (英語と日本語訳)
    6. 関連語やコロケーション
    
    特に例文は必ず含めるようにしてください。例文は日常会話で使えるような簡潔で分かりやすいものにしてください。
  `;

  try {
    return await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 1200,
      temperature: 0.7,
      systemPrompt: 'あなたは英語教育の専門家です。学習者が効果的に英単語を学べるよう、わかりやすく実用的な情報を提供してください。'
    });
  } catch (error: any) {
    console.error('Error generating vocabulary practice:', error);
    return '申し訳ありませんが、ボキャブラリーの生成中にエラーが発生しました。後でもう一度お試しください。';
  }
}