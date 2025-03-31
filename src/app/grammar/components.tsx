'use client';

import { useState, useEffect } from 'react';

// Helper component to render essays with error highlighting
export function EssayWithErrors({ 
  essay, 
  errors 
}: { 
  essay: string,
  errors: {
    type: string;
    text: string;
    startPos: number;
    endPos: number;
    explanation: string;
  }[]
}) {
  const [activeErrorIndex, setActiveErrorIndex] = useState<number | null>(null);
  const [processedErrors, setProcessedErrors] = useState<typeof errors>([]);
  
  // Process and validate errors on mount or when errors change
  useEffect(() => {
    console.log("EssayWithErrors received errors:", JSON.stringify(errors, null, 2));
    console.log("Essay content length:", essay.length);
    // Detail check some errors if available
    if (errors && errors.length > 0) {
      console.log("First error details:", {
        type: errors[0].type,
        text: errors[0].text,
        positions: `${errors[0].startPos}-${errors[0].endPos}`,
        textFromPositions: essay.substring(errors[0].startPos, errors[0].endPos),
        explanation: errors[0].explanation
      });
    }
    
    // Filter out invalid errors and sort by position
    const validErrors = (errors || [])
      .filter(error => 
        typeof error.startPos === 'number' && 
        typeof error.endPos === 'number' &&
        error.startPos >= 0 &&
        error.endPos <= essay.length &&
        error.startPos < error.endPos
      )
      .sort((a, b) => a.startPos - b.startPos);
    
    console.log(`EssayWithErrors: Processing ${errors?.length || 0} errors, ${validErrors.length} valid`);
    
    // Only keep non-overlapping errors
    const nonOverlappingErrors: typeof errors = [];
    let lastEndPos = -1;
    
    for (const error of validErrors) {
      if (error.startPos >= lastEndPos) {
        nonOverlappingErrors.push(error);
        lastEndPos = error.endPos;
      } else {
        console.log(`EssayWithErrors: Skipping overlapping error at pos ${error.startPos}-${error.endPos}`);
      }
    }
    
    setProcessedErrors(nonOverlappingErrors);
  }, [essay, errors]);
  
  if (!essay) {
    return <div className="p-3 italic text-gray-500">No essay content</div>;
  }
  
  if (!processedErrors || processedErrors.length === 0) {
    // No errors found, display the essay as-is
    console.log("EssayWithErrors: No valid errors to display");
    return (
      <div className="relative whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
        {essay}
        {errors && errors.length > 0 && (
          <div className="absolute top-0 right-0 p-1 bg-yellow-100 text-xs text-yellow-800 rounded-bl">
            エラー検出問題: {errors.length}件のエラーが正しく表示されていません
          </div>
        )}
      </div>
    );
  }
  
  // Build the parts array
  const parts = [];
  let lastIndex = 0;
  
  processedErrors.forEach((error, index) => {
    // Add text before the error
    if (error.startPos > lastIndex) {
      parts.push(
        <span key={`text-${index}`}>{essay.substring(lastIndex, error.startPos)}</span>
      );
    }
    
    // Add the highlighted error
    parts.push(
      <span 
        key={`error-${index}`}
        className="bg-red-100 border-b-2 border-red-500 text-red-800 cursor-pointer relative"
        onClick={() => setActiveErrorIndex(activeErrorIndex === index ? null : index)}
      >
        {essay.substring(error.startPos, error.endPos)}
        {activeErrorIndex === index && (
          <span className="absolute z-10 left-0 transform -translate-y-full mt-[-8px] p-2 bg-white border border-red-200 rounded shadow-md text-sm min-w-[200px] max-w-[300px]">
            <span className="font-bold text-red-600">{error.type}:</span> {error.explanation}
          </span>
        )}
      </span>
    );
    
    lastIndex = error.endPos;
  });
  
  // Add remaining text after the last error
  if (lastIndex < essay.length) {
    parts.push(
      <span key="text-end">{essay.substring(lastIndex)}</span>
    );
  }
  
  return (
    <div className="relative whitespace-pre-wrap bg-gray-50 p-3 rounded border border-gray-200">
      {parts}
      <div className="text-xs text-gray-500 mt-2">
        {processedErrors.length > 0 ? 
          `${processedErrors.length}個の文法エラーが見つかりました。赤い部分をクリックすると説明が表示されます。` : 
          '文法エラーは見つかりませんでした。'}
      </div>
    </div>
  );
} 