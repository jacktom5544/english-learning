// Simple script to test MongoDB connection
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
  console.log('Testing MongoDB connection...');
  
  // Read the MongoDB URI from environment
  const MONGODB_URI = process.env.MONGODB_URI;
  
  if (!MONGODB_URI) {
    console.error('MONGODB_URI is not defined in environment variables!');
    return;
  }

  console.log(`Connection string: ${MONGODB_URI.substring(0, 20)}...`);
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    const conn = await mongoose.connect(MONGODB_URI, {
      bufferCommands: false
    });
    
    console.log('Connected successfully!');
    console.log('MongoDB version:', conn.connection.version);
    console.log('Connection state:', conn.connection.readyState);
    
    // Try to list collections
    const collections = await conn.connection.db.listCollections().toArray();
    console.log('Collections:', collections.map(c => c.name));
    
    // Close the connection
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
  }
}

testConnection(); 