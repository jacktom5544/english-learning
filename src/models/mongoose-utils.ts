import mongoose, { Model, Document } from 'mongoose';
import { safeError, safeLog } from '@/lib/utils';

/**
 * Type-safe wrapper functions for Mongoose operations
 * These functions help avoid TypeScript errors with Mongoose's complex types
 */

/**
 * Safe wrapper for Model.find
 */
export async function findDocuments<T>(
  model: Model<any>,
  filter: Record<string, any> = {}
): Promise<T[]> {
  try {
    // Use any type to bypass TypeScript's strict checking
    // and then cast to the appropriate type at the end
    const query: any = model.find(filter);
    return await query.exec() as T[];
  } catch (error) {
    safeError('Error in findDocuments:', error);
    return [];
  }
}

/**
 * Safe wrapper for Model.findById
 */
export async function findDocumentById<T>(
  model: Model<any>,
  id: string
): Promise<T | null> {
  try {
    const query: any = model.findById(id);
    return await query.exec() as T | null;
  } catch (error) {
    safeError('Error in findDocumentById:', error);
    return null;
  }
}

/**
 * Safe wrapper for Model.findOne
 */
export async function findOneDocument<T>(
  model: Model<any>,
  filter: Record<string, any>
): Promise<T | null> {
  try {
    const modelName = model.modelName;
    safeLog(`[mongoose-utils] Executing findOne on ${modelName} with filter:`, filter);
    const query: any = model.findOne(filter);
    const startTime = Date.now();
    const result = await query.exec() as T | null;
    const duration = Date.now() - startTime;
    safeLog(`[mongoose-utils] findOne on ${modelName} completed in ${duration}ms. Found: ${!!result}`);
    return result;
  } catch (error) {
    // Log the specific error from findOne execution
    safeError(`[mongoose-utils] Error executing findOne on ${model.modelName}:`, error);
    return null;
  }
}

/**
 * Safe wrapper for query chaining with select and sort
 */
export async function findDocumentsWithOptions<T>(
  model: Model<any>,
  filter: Record<string, any> = {},
  select: string | Record<string, any> | null = null,
  sort: Record<string, any> | null = null
): Promise<T[]> {
  try {
    // Use any type to bypass TypeScript's strict checking
    let query: any = model.find(filter);
    
    if (select) {
      query = query.select(select);
    }
    
    if (sort) {
      query = query.sort(sort);
    }
    
    return await query.exec() as T[];
  } catch (error) {
    safeError('Error in findDocumentsWithOptions:', error);
    return [];
  }
} 