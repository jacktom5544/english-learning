import mongoose from 'mongoose';
import Vocabulary from '../models/Vocabulary';
import { generateAIResponse } from '../lib/ai';
import connectDB from '../lib/db';

// Connect to database
async function main() {
  console.log('Connecting to database...');
  await connectDB();
  
  console.log('Fetching vocabularies without example sentences...');
  const vocabularies = await Vocabulary.find({ 
    $or: [
      { exampleSentence: { $exists: false } },
      { exampleSentence: null },
      { exampleSentence: "" }
    ]
  });
  
  console.log(`Found ${vocabularies.length} vocabularies without example sentences`);
  
  let updatedCount = 0;
  
  // Process in batches of 10 to avoid overloading the AI service
  for (let i = 0; i < vocabularies.length; i += 10) {
    const batch = vocabularies.slice(i, i + 10);
    console.log(`Processing batch ${i/10 + 1} (${batch.length} items)...`);
    
    const promises = batch.map(async (vocabulary) => {
      try {
        const word = vocabulary.word;
        console.log(`Generating example sentence for "${word}"...`);
        
        // Generate an example sentence using the AI
        const prompt = `
          Create a simple, everyday example sentence in English using the word "${word}".
          The sentence should be appropriate for English learners and demonstrate how to use the word correctly.
          Reply with only the example sentence, nothing else.
        `;
        
        const exampleSentence = await generateAIResponse([{ role: 'user', content: prompt }], {
          maxTokens: 100,
          temperature: 0.7,
        });
        
        // Update the vocabulary with the example sentence
        vocabulary.exampleSentence = exampleSentence.trim();
        await vocabulary.save();
        
        console.log(`Updated "${word}" with example: "${exampleSentence.trim()}"`);
        updatedCount++;
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`Error updating vocabulary ${vocabulary.word}:`, error);
      }
    });
    
    // Wait for all promises in this batch to complete
    await Promise.all(promises);
    
    // Wait a bit between batches
    if (i + 10 < vocabularies.length) {
      console.log('Waiting before next batch...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`Updated ${updatedCount} out of ${vocabularies.length} vocabularies`);
  console.log('Migration complete');
  
  await mongoose.disconnect();
  console.log('Database connection closed');
}

// Run the script
main().catch(err => {
  console.error('Error in migration script:', err);
  process.exit(1);
}); 