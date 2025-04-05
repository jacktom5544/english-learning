import { IUser } from '@/models/User';
import { generateAIResponse, AIMessage } from './ai';
import { JAPANESE_TEACHER_PROFILES, JapaneseTeacherKey } from './japanese-teachers';
import 'server-only';

type MessageHistory = Array<{
  sender: 'user' | 'teacher';
  content: string;
  timestamp: Date;
}>;

/**
 * Analyzes student information and generates an initial coaching message
 */
export async function generateInitialCoachingMessage(
  teacherKey: JapaneseTeacherKey,
  user: IUser
): Promise<string> {
  const userName = user.name;
  const userEnglishLevel = user.englishLevel || 'beginner';
  const userJob = user.job || '未記入';
  const userGoal = user.goal || '未記入';
  const startReason = user.startReason || '未記入';
  const struggles = user.struggles || '未記入';
  
  // Create a prompt for the AI
  const prompt = `
    あなたは ${JAPANESE_TEACHER_PROFILES[teacherKey].name} として日本人学生 ${userName} さんにコーチングセッションの初回メッセージを書きます。

    学生情報:
    - 英語レベル: ${userEnglishLevel}
    - 職業・業種: ${userJob}
    - 英語学習の目標: ${userGoal}
    - 何故英語学習を始めようと思ったのか？: ${startReason}
    - 英語学習での悩み事: ${struggles}

    この情報を分析して、以下のような初回メッセージを作成してください：
    1. 学生の情報を参照し、個人的な挨拶をする
    2. 学生の目標と悩みに言及し、共感を示す
    3. 学生の学習状況や最近の取り組みについて質問する
    4. 現在の悩みや課題について詳しく聞く
    5. コーチとして今後どのようにサポートしていきたいかを伝える
    6. メッセージ内に英語表現をいくつか入れ、学びの機会を提供する

    教師の性格や口調は ${JAPANESE_TEACHER_PROFILES[teacherKey].name} のプロファイルに沿って一貫させてください。
    一人称は「${JAPANESE_TEACHER_PROFILES[teacherKey].prefix}」を使用してください。
  `;
  
  try {
    const messages: AIMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    // Generate the AI response
    const response = await generateAIResponse(messages, {
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: JAPANESE_TEACHER_PROFILES[teacherKey].writingFeedbackPersonaPrompt
    });
    
    return response;
  } catch (error) {
    console.error('Error generating initial coaching message:', error);
    
    // Return fallback message if AI generation fails
    const fallbackMessages = {
      hiroshi: `やあ、${userName}はん！ひろし先生やで！\n\n${userName}はんの情報見せてもらったで。${userJob}の仕事しながら、「${userGoal}」って目標を持って英語頑張ってるんやな。「${startReason}」って理由で始めたんや。ほんまええ心がけやで！\n\n「${struggles}」って悩みがあるみたいやけど、心配せんでええで。一緒に解決していこう！\n\nそれで、最近どない？英語の勉強はどれくらいの時間やってる？What's your daily study routine like?（毎日の勉強ルーティンはどんな感じ？）今抱えてる一番の悩みとか教えてくれへんか？\n\n${JAPANESE_TEACHER_PROFILES[teacherKey].prefix}がしっかりサポートするからな！Let's improve your English together!（一緒に英語力上げていこう！）`,
      reiko: `${userName}さん、はじめまして。玲子でございますわ。\n\n${userName}さんのプロファイルを拝見いたしました。${userJob}でいらっしゃるのですね。英語学習の目標は「${userGoal}」とのこと。「${startReason}」というきっかけで英語を始められたのは素晴らしい決断でございますわ。\n\n「${struggles}」とのお悩みがあるようですが、ご安心くださいませ。わたくしがしっかりとサポートいたしますわ。\n\n最近のご様子はいかがでしょうか？English study requires consistent effort（英語学習には継続的な努力が必要です）。日々どのくらいお時間を取られていますの？現在の具体的なお悩みなどございましたら、ぜひお聞かせくださいませ。\n\n${JAPANESE_TEACHER_PROFILES[teacherKey].prefix}が精一杯お力添えいたしますわ。Let's work towards your goals together（目標に向かって一緒に頑張りましょう）。`,
      iwao: `よう、${userName}！巌男（いわお）だ！\n\n${userName}のことを見たぞ。${userJob}やってんのか。「${userGoal}」が目標なんだな。「${startReason}」って理由で英語始めたのか。いいぞ、その意気だ！\n\n「${struggles}」って悩みがあるみたいだな。心配すんな！俺がしっかり鍛えてやるからよ！\n\n最近どうだ？英語の勉強、一日何時間やってる？How many hours do you study English every day?（毎日何時間英語の勉強してるんだ？）少なすぎたら叱るからな！今一番困ってることは何だ？正直に言ってみろ！\n\n${JAPANESE_TEACHER_PROFILES[teacherKey].prefix}がバッチリ教えてやるからな！Don't give up!（諦めるんじゃねえぞ！）`,
      taro: `こんにちは、${userName}さん。太郎です。\n\n${userName}さんのプロフィールを拝見しました。${userJob}をされているんですね。英語学習の目標は「${userGoal}」とのこと。「${startReason}」という理由で英語学習を始められたんですね。素晴らしい動機だと思います。\n\n「${struggles}」というお悩みがあるようですが、大丈夫です。一緒に解決していきましょう。\n\n最近はいかがですか？英語学習には毎日の継続が大切です。In English learning, consistency is key（英語学習では継続が鍵です）。毎日どのくらい時間を取れていますか？現在の具体的な課題や疑問点があれば、ぜひ教えてください。\n\n${JAPANESE_TEACHER_PROFILES[teacherKey].prefix}がしっかりサポートします。Let's achieve your goals together（一緒に目標を達成しましょう）。`
    };
    
    return fallbackMessages[teacherKey] || `こんにちは、${userName}さん。コーチングを始めましょう。`;
  }
}

/**
 * Generates coach responses based on user message, conversation history and teacher personality
 */
export async function generateCoachingResponse(
  teacherKey: JapaneseTeacherKey,
  userMessage: string,
  user: IUser,
  messageHistory: MessageHistory
): Promise<string> {
  try {
    // Format the conversation history for the AI
    const formattedHistory: AIMessage[] = [];
    
    // Add the last 10 messages from the conversation history (or fewer if there are less)
    const recentMessages = messageHistory.slice(-10);
    
    // Format message history for the AI
    for (const message of recentMessages) {
      formattedHistory.push({
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: message.content
      });
    }
    
    // If the last message in history is not the current message, add it
    const lastMessage = messageHistory[messageHistory.length - 1];
    if (!lastMessage || lastMessage.sender !== 'user' || lastMessage.content !== userMessage) {
      formattedHistory.push({
        role: 'user',
        content: userMessage
      });
    }
    
    // Create a system prompt for the coaching session
    const coachingSystemPrompt = `
      あなたは英語学習コーチの ${JAPANESE_TEACHER_PROFILES[teacherKey].name} です。
      以下の性格と口調で会話してください：
      ${JAPANESE_TEACHER_PROFILES[teacherKey].writingFeedbackPersonaPrompt}
      
      一人称は「${JAPANESE_TEACHER_PROFILES[teacherKey].prefix}」を使ってください。
      
      学生情報:
      - 名前: ${user.name}
      - 英語レベル: ${user.englishLevel || '未記入'}
      - 職業・業種: ${user.job || '未記入'}
      - 英語学習の目標: ${user.goal || '未記入'}
      - 何故英語学習を始めようと思ったのか？: ${user.startReason || '未記入'}
      - 英語学習での悩み事: ${user.struggles || '未記入'}
      
      コーチングのガイドライン:
      1. 学生の状況に合った具体的かつ現実的なアドバイスを提供する
      2. 学生がどれくらい勉強しているか質問し、時間が短すぎる場合は適切に指摘する
      3. 学生の状況に合った英語学習方法を提案する
      4. ポジティブな態度を保ち、学生の学習意欲を高める
      5. メッセージには必ず英語のフレーズや表現を適宜入れ、学習の機会を提供する
      6. アドバイスは具体的かつ実行可能なものにする
      
      回答は必ず日本語で行い、英語の表現や例文を適宜含めてください。
    `;
    
    // Generate response with the AI
    const response = await generateAIResponse(formattedHistory, {
      maxTokens: 1000,
      temperature: 0.7,
      systemPrompt: coachingSystemPrompt
    });
    
    return response;
  } catch (error) {
    console.error('Error generating coaching response:', error);
    
    // Fallback to basic responses if the AI call fails
    const userName = user.name;
    const lowerCaseMessage = userMessage.toLowerCase();
    
    // Include some references to user's learning motivations and struggles in fallback responses
    const strugglesReference = user.struggles ? `「${user.struggles}」という悩みについて、` : '';
    const motivationReference = user.startReason ? `「${user.startReason}」という理由で英語を学び始めたのは素晴らしいです。` : '';
    
    // Basic fallback messages by teacher type
    const fallbackMessages = {
      hiroshi: `なるほどな、${userName}はん。${strugglesReference}${motivationReference}ええ感じやで！ "Keep going with your studies!" (勉強を続けていこう！) 何か具体的に悩んでることあったら、もっと詳しく教えてくれへんか？`,
      reiko: `${userName}さん、素晴らしいですわ。${strugglesReference}${motivationReference}"Consistency is the key to success." (継続は成功の鍵ですわ) もう少し詳しくお聞かせいただけますか？`,
      iwao: `そうか、${userName}！${strugglesReference}${motivationReference}いいぞ、その調子だ！ "Never give up!" (絶対に諦めるな！) もっと詳しく話してみろ！`,
      taro: `${userName}さん、なるほどですね。${strugglesReference}${motivationReference}"Practice makes perfect." (練習が完璧を作ります) もう少し詳しく教えていただけますか？`
    };
    
    return fallbackMessages[teacherKey] || `${userName}さん、引き続き頑張りましょう。何か具体的な質問はありますか？`;
  }
}

/**
 * Generates a title for a new coaching session
 */
export async function generateCoachingSessionTitle(
  teacherKey: JapaneseTeacherKey,
  initialMessageContent: string
): Promise<string> {
  try {
    const prompt = `
      あなたは ${JAPANESE_TEACHER_PROFILES[teacherKey].name} として、コーチングセッションのタイトルを生成します。
      以下のメッセージ内容から、このセッションを表す簡潔なタイトル（10-20文字程度）を日本語で考えてください：
      
      メッセージ内容:
      "${initialMessageContent.substring(0, 300)}${initialMessageContent.length > 300 ? '...' : ''}"
    `;
    
    const messages: AIMessage[] = [
      { role: 'user', content: prompt }
    ];
    
    const response = await generateAIResponse(messages, {
      maxTokens: 50,
      temperature: 0.7,
    });
    
    // Clean up the response - remove quotes and trim
    const title = response.replace(/["「」]/g, '').trim();
    
    // Limit title length and return
    return title.length > 30 ? title.substring(0, 30) + '...' : title;
  } catch (error) {
    console.error('Error generating coaching session title:', error);
    
    // Return a default title with timestamp
    const date = new Date();
    const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
    return `${JAPANESE_TEACHER_PROFILES[teacherKey].name}とのセッション (${dateStr})`;
  }
} 