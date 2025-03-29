import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { uploadToCloudinary } from '@/lib/cloudinary';

export async function POST(request: NextRequest) {
  try {
    // Verify the request contains a valid token
    const token = await getToken({ req: request });
    
    if (!token) {
      return NextResponse.json(
        { error: '認証エラー' },
        { status: 401 }
      );
    }

    // Get the image data from the request
    const { image } = await request.json();
    
    if (!image) {
      return NextResponse.json(
        { error: '画像データが見つかりません' },
        { status: 400 }
      );
    }

    // Upload the image to Cloudinary
    const imageUrl = await uploadToCloudinary(image);
    
    return NextResponse.json({
      success: true,
      url: imageUrl
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'サーバーエラーが発生しました' },
      { status: 500 }
    );
  }
} 