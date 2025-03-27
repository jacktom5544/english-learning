import deepseek from './deepseek';

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
 * @returns The generated quiz
 */
export async function generateEnglishQuiz(topic: string, level: string, count: number = 10) {
  // Ensure count is within reasonable limits
  const questionCount = Math.min(Math.max(count, 1), 20);
  
  const prompt = `
    制作条件: 
    - トピック: ${topic}
    - レベル: ${level}
    - 問題数: ${questionCount}問（全て異なる英単語を使用すること）
    - 言語: 日本語と英語を併記
    
    以下の形式で英語クイズを作成してください:
    
    まず、ユーザーが指定したトピックと英語レベルに関連する${questionCount}個の英単語とその意味を考えてください。
    それぞれの単語は異なる単語である必要があります。
    
    そして、各単語について以下の形式でクイズを作成してください:
    
    [
      {
        "question": "英単語そのもの（例："Patient"）",
        "choices": ["選択肢1（日本語）", "選択肢2（日本語）", "選択肢3（日本語）", "選択肢4（日本語）", "選択肢5（日本語）"],
        "correctIndex": 0～4のいずれか（正解の選択肢のインデックス）,
        "explanation": "この単語の説明や使い方（日本語）"
      },
      ...残りの単語も同様の形式で...
    ]
    
    重要：
    1. 必ず${questionCount}問の異なる問題を作成してください
    2. JSONフォーマットで出力してください
    3. questionに英単語、choicesに日本語の単語（5つ）を含めてください
    4. correctIndexは必ず0から4の整数値で、choicesの正解のインデックスにしてください
    5. 選択肢は必ず5つ用意してください
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
            typeof item.explanation === 'string'
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
 * Provide feedback on a student's English writing
 * @param text - The student's text to analyze
 * @param feedbackType - Type of feedback requested (grammar, style, etc.)
 * @returns Detailed feedback
 */
export async function provideWritingFeedback(text: string, feedbackType: string = 'comprehensive') {
  const prompt = `
    以下の英文を添削し、${feedbackType}フィードバックを提供してください:
    
    ${text}
    
    フィードバックは関西弁で漫才風に記述してください。
    もしもAIが作成したトピックとユーザーが作成した英文が関連性がない場合は、ユーザーをきつく𠮟って下さい。
    
    以下のフォーマットで回答してください:
    
    1. 全体的な評価 (日本語)
    
    (ここに評価の内容)
    
    2. 文法の誤りと修正案 (具体的に指摘)
    
    (ここに文法の誤りと修正案)
    
    3. 表現の改善点 (より自然な言い回し)
    
    (ここに表現の改善点)
    
    4. 強みと弱み
    
    (ここに強みと弱み)
    
    5. 上達のためのアドバイス
    
    (ここにアドバイス)

    6. 総合点数
    
    (ここに点数)
    
    強調したい部分は **このように** または __このように__ 記述してください。
  `;

  try {
    return await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 800,
      temperature: 0.7,
      systemPrompt: 'あなたは英語教師です。学生の英作文に対して、建設的で詳細なフィードバックを提供してください。批判的すぎず、励ましながらも正確な指導をしてください。'
    });
  } catch (error: any) {
    console.error('Error providing writing feedback:', error);
    return '申し訳ありませんが、フィードバックの生成中にエラーが発生しました。後でもう一度お試しください。';
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