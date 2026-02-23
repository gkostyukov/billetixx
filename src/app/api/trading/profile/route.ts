import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { loadUserTradingRuntimeConfig } from '../../../../../engine/userTradingConfig';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await loadUserTradingRuntimeConfig(session.user.id);

    return NextResponse.json({
      activeProfile: config.activeProfile,
      profiles: config.strategyProfiles,
    });
  } catch (error: any) {
    console.error('Trading profile GET error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to load trading profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const profile = String(body?.profile || '').toLowerCase();

    if (profile !== 'strict' && profile !== 'soft') {
      return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });
    }

    await prisma.userTradingConfig.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        activeProfile: profile,
      },
      update: {
        activeProfile: profile,
      },
    });

    const config = await loadUserTradingRuntimeConfig(session.user.id);

    return NextResponse.json({
      activeProfile: config.activeProfile,
      profiles: config.strategyProfiles,
    });
  } catch (error: any) {
    console.error('Trading profile POST error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to update trading profile' }, { status: 500 });
  }
}
