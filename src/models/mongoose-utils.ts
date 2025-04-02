import mongoose, { Model, Document } from 'mongoose';
import { safeError } from '@/lib/utils';

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
    const query: any = model.findOne(filter);
    return await query.exec() as T | null;
  } catch (error) {
    safeError('Error in findOneDocument:', error);
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