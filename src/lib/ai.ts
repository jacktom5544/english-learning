import deepseek from './deepseek';
import 'server-only';

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
  timeout?: number; // Add timeout option
};

/**
 * Generate a response from DeepSeek AI with improved timeout handling and streaming
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
    systemPrompt = 'You are a helpful assistant specialized in English language learning for Japanese users. Keep responses clear and concise.',
    timeout = 25000, // Default to 25 seconds
  } = options;

  // Ensure there's a system message at the beginning if not already present
  const formattedMessages = messages[0]?.role === 'system' 
    ? messages 
    : [{ role: 'system' as MessageRole, content: systemPrompt }, ...messages];

  // Create a promise that will reject after the timeout
  const timeoutPromise = new Promise<never>((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('AI response timeout'));
    }, timeout);
    
    // Clean up the timeout if the promise is resolved before timeout
    timeoutPromise.finally(() => clearTimeout(timeoutId));
  });

  try {
    console.log('Sending request to DeepSeek API...');
    
    if (!deepseek || !deepseek.chat || !deepseek.chat.completions) {
      console.error('DeepSeek API client is not properly initialized');
      throw new Error('AI APIクライアントの初期化エラー');
    }
    
    // Use streaming for more reliable responses
    const streamResponse = await Promise.race([
      deepseek.chat.completions.create({
        model: 'deepseek-chat', // Always use deepseek-chat, not the more expensive reasoner
        messages: formattedMessages as any, // Type assertion to avoid type conflicts
        max_tokens: maxTokens,
        temperature: temperature,
        stream: true, // Enable streaming
      }),
      timeoutPromise
    ]);

    // Collect the streamed response
    let fullResponse = '';
    for await (const chunk of streamResponse) {
      const content = chunk.choices[0]?.delta?.content || '';
      fullResponse += content;
    }

    if (!fullResponse) {
      console.error('DeepSeek API returned an empty response');
      throw new Error('AIからの応答が空でした');
    }

    return fullResponse;
  } catch (error: any) {
    console.error('DeepSeek AI error:', error);
    
    // Check if it's a timeout error
    if (error.message && (error.message.includes('timeout') || error.name === 'AbortError')) {
      console.error('AI request timed out after', timeout, 'ms');
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
 * Provide feedback on a student's English writing
 * @param text - The student's text to analyze
 * @param feedbackType - Type of feedback requested (grammar, style, etc.)
 * @param teacher - The preferred teacher character ('hiroshi', 'reiko', 'iwao', 'taro')
 * @returns Detailed feedback
 */
export async function provideWritingFeedback(
  text: string, 
  feedbackType: string = 'comprehensive',
  teacher: string = 'taro'
) {
  let teacherPrompt = '';
  
  switch(teacher) {
    case 'hiroshi':
      teacherPrompt = `
        フィードバックは関西弁で漫才風の明るい口調で記述してください。
        初心者あるあるの文法ぐちゃぐちゃの英文でも気さくにチェックしてアドバイスしてください。
        口調はちょっとトゲがあるかもだけど心根は優しい先生として回答してください。
        「やねん」「〜やで」「〜ちゃう？」などの関西弁を使ってください。
        
        例: 「おっ！この文法ちょっと違うかもしれへんな。でもな、この部分はええ感じやで！」
      `;
      break;
    case 'reiko':
      teacherPrompt = `
        フィードバックは「ですわ」口調の上品な女性として記述してください。
        頭脳明晰、容姿端麗で一見接しにくいように感じるけど生徒想いの優しい先生として回答してください。
        「ですわ」「〜でございますわ」「わたくし」などの言葉を使ってください。
        分かりやすく丁寧に、特に初心者の方には文法で躓きやすい部分を手取り足取り教えるスタイルで回答してください。
        
        例: 「この文法の使い方は少し異なりますわ。このように書くとより自然ですわ。」
      `;
      break;
    case 'iwao':
      teacherPrompt = `
        フィードバックは昭和のスタイルを貫く厳格な男性として記述してください。
        文法ミスを厳しく指摘しますが、生徒想いがとても強い先生として回答してください。
        「〜じゃねーぞ」「テメー」「〜するんだよ！」などの言葉を使い、時に厳しい言葉も使いますが、
        その厳しさは生徒を成長させるためであることを示してください。
        
        例: 「この文法、なんだこれは！こんなんじゃダメだ！ここはこう書くんだよ！でも、この部分は良く書けている。その調子だ！」
      `;
      break;
    case 'taro':
    default:
      teacherPrompt = `
        フィードバックは標準語で理詰めで丁寧な口調で記述してください。
        若手の先生として、欠点らしい欠点も無く、どんなタイプの生徒でも上手く対応するスタイルで回答してください。
        「〜ですね」「〜しましょう」「〜だと思います」などの丁寧な言葉を使い、
        文法の間違いを論理的に、かつ励ましながら説明してください。
        
        例: 「ここの文法は少し異なります。このように書くとより自然な表現になりますよ。」
      `;
      break;
  }

  const prompt = `
    以下の英文を添削し、${feedbackType}フィードバックを提供してください:
    
    ${text}
    
    ${teacherPrompt}
    
    もしもAIが作成したトピックとユーザーが作成した英文が関連性がない場合は、それについても指摘してください。
    
    以下のフォーマットで回答してください:
    
    1. 全体的な評価 (日本語)
    
    (ここに評価の内容)
    
    2. 文法の誤りと修正案 (具体的に指摘)
    
    (ここに文法の誤りと修正案)
    
    3. 表現の改善点 (より自然な言い回し)
    
    (ここに表現の改善点)
    
    4. 採点 (100点満点)
    
    (ここに点数)
    
    5. 励ましのコメント
    
    (ここに励ましのコメント)
  `;

  try {
    // Generate the feedback using the AI
    const systemPrompt = `
      あなたは日本人の英語学習者のための添削を行う英語教師です。
      ${teacherPrompt}
      フィードバックは具体的で分かりやすく、学習者の英語レベル向上に役立つものにしてください。
    `;
    
    const response = await generateAIResponse([{ role: 'user', content: prompt }], {
      maxTokens: 1500,
      temperature: 0.7,
      systemPrompt
    });
    
    return response;
  } catch (error: any) {
    console.error('Error providing writing feedback:', error);
    return `申し訳ありません。フィードバックの生成中にエラーが発生しました。後でもう一度お試しください。\n\nエラー: ${error.message || '不明なエラー'}`;
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