import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

export async function GET() {
  try {
    const uri = process.env.MONGODB_URI;
    
    if (!uri) {
      return NextResponse.json({
        success: false,
        error: "MONGODB_URI environment variable is not defined"
      }, { status: 500 });
    }
    
    console.log('Testing direct MongoDB connection with MongoClient...');
    console.log('Connection string starts with:', uri.substring(0, 20) + '...');
    
    // Using MongoClient directly instead of mongoose
    const client = new MongoClient(uri);
    
    // Connect to the server
    console.log('Attempting to connect...');
    await client.connect();
    console.log('Connected successfully to MongoDB server');
    
    // Get basic server info
    const serverInfo = await client.db().admin().serverInfo();
    
    // List all databases
    const dbList = await client.db().admin().listDatabases();
    
    // Close the connection
    await client.close();
    console.log('Connection closed properly');
    
    // Return success with server info
    return NextResponse.json({
      success: true,
      message: "Successfully connected to MongoDB",
      version: serverInfo.version,
      databases: dbList.databases.map(db => db.name),
      connection_string_prefix: uri.substring(0, 20) + '...'
    });
  } catch (error: any) {
    console.error("MongoDB connection error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 