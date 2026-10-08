import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';

const REVALIDATION_SECRET = process.env.REVALIDATION_SECRET || 'dev-secret';

export async function POST(request: NextRequest) {
  // Verify the secret
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || authHeader !== `Bearer ${process.env.REVALIDATION_SECRET || 'dev-secret'}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { paths } = body;

    if (!paths || !Array.isArray(paths)) {
      return NextResponse.json({ error: 'Invalid paths array' }, { status: 400 });
    }

    // Revalidate each path
    for (const path of paths) {
      try {
        revalidatePath(path);
        console.log(`Revalidated path: ${path}`);
      } catch (error) {
        console.error(`Failed to revalidate path ${path}:`, error);
      }
    }

    return NextResponse.json({ success: true, revalidated: paths.length });
  } catch (error) {
    console.error('Revalidation error:', error);
    return NextResponse.json({ error: 'Revalidation failed' }, { status: 500 });
  }
}