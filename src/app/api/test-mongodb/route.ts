import { NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { SSMClient, GetParameterCommand } from "@aws-sdk/client-ssm"; // Import AWS SDK SSM Client

// Function to get parameter from SSM
async function getParameterFromSSM(name: string): Promise<string | null> {
  // Construct the parameter name as Amplify typically stores it
  // You might need to adjust the path based on your Amplify App ID and environment name
  // Check your SSM Parameter Store in the AWS Console to confirm the exact path
  const amplifyAppId = process.env.AWS_APP_ID; // Amplify usually sets this
  const amplifyEnvName = process.env.AWS_BRANCH; // Amplify uses branch name as env name
  
  if (!amplifyAppId || !amplifyEnvName) {
    console.error('Could not determine Amplify App ID or Environment Name from standard env vars (AWS_APP_ID, AWS_BRANCH).');
    // Fallback to trying the direct variable name
    // return null; 
  }
  
  // Example path structure: /amplify/YOUR_APP_ID/YOUR_ENV_NAME/AMPLIFY_MONGODB_URI 
  // Note: Amplify might prefix variables, e.g., AMPLIFY_MONGODB_URI
  // Check your SSM Parameter Store for the exact name!
  const parameterName = `/amplify/${amplifyAppId}/${amplifyEnvName}/MONGODB_URI`;
  const fallbackParameterName = `/amplify/${amplifyAppId}/${amplifyEnvName}/AMPLIFY_MONGODB_URI`;
  
  console.log(`Attempting to fetch SSM Parameter: ${parameterName} or ${fallbackParameterName}`);

  const client = new SSMClient({});
  
  try {
    const command = new GetParameterCommand({ Name: parameterName, WithDecryption: true });
    const response = await client.send(command);
    if (response.Parameter?.Value) {
      console.log(`Successfully fetched ${parameterName} from SSM.`);
      return response.Parameter.Value;
    }
  } catch (error: any) {
    if (error.name !== 'ParameterNotFound') {
        console.warn(`Error fetching ${parameterName} from SSM:`, error);
    } else {
        console.log(`${parameterName} not found, trying fallback.`);
    }
    // Try fallback name if the first one wasn't found
    try {
      const fallbackCommand = new GetParameterCommand({ Name: fallbackParameterName, WithDecryption: true });
      const fallbackResponse = await client.send(fallbackCommand);
      if (fallbackResponse.Parameter?.Value) {
        console.log(`Successfully fetched ${fallbackParameterName} from SSM.`);
        return fallbackResponse.Parameter.Value;
      }
    } catch (fallbackError: any) {
      if (fallbackError.name !== 'ParameterNotFound') {
        console.warn(`Error fetching ${fallbackParameterName} from SSM:`, fallbackError);
      } else {
        console.log(`${fallbackParameterName} not found either.`);
      }
    }
  }
  
  console.warn(`Parameter ${parameterName} (or fallback) not found in SSM.`);
  return null;
}

export async function GET() {
  let uri: string | null | undefined;
  
  try {
    // 1. Try getting from standard process.env first
    uri = process.env.MONGODB_URI;
    console.log('Attempt 1: Checking process.env.MONGODB_URI...');
    if (uri) {
      console.log('Found MONGODB_URI in process.env');
    } else {
      console.log('MONGODB_URI not found in process.env. Attempting SSM fetch...');
      // 2. If not in process.env, try fetching from SSM Parameter Store
      uri = await getParameterFromSSM('MONGODB_URI');
    }

    if (!uri) {
      console.error('Failed to get MONGODB_URI from both process.env and SSM Parameter Store.');
      return NextResponse.json({
        success: false,
        error: "MONGODB_URI could not be resolved from environment variables or SSM Parameter Store."
      }, { status: 500 });
    }
    
    console.log('Testing direct MongoDB connection with MongoClient...');
    console.log('Using Connection string starting with:', uri.substring(0, 20) + '...');
    
    const client = new MongoClient(uri);
    console.log('Attempting to connect...');
    await client.connect();
    console.log('Connected successfully to MongoDB server');
    
    const serverInfo = await client.db().admin().serverInfo();
    const dbList = await client.db().admin().listDatabases();
    await client.close();
    console.log('Connection closed properly');
    
    return NextResponse.json({
      success: true,
      message: "Successfully connected to MongoDB",
      source: process.env.MONGODB_URI ? 'process.env' : 'SSM Parameter Store',
      version: serverInfo.version,
      databases: dbList.databases.map(db => db.name),
      connection_string_prefix: uri.substring(0, 20) + '...'
    });

  } catch (error: any) {
    console.error("MongoDB connection error:", error);
    return NextResponse.json({
      success: false,
      error: error.message,
      source_attempted: process.env.MONGODB_URI ? 'process.env' : 'SSM Parameter Store',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
} 