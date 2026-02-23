import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { loadStrategyConfig, setActiveStrategyProfile, type StrategyProfile } from '../../../../../engine/strategyConfig';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const config = await loadStrategyConfig();

    return NextResponse.json({
      activeProfile: config.activeProfile,
      profiles: config.profiles,
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

    const updated = await setActiveStrategyProfile(profile as StrategyProfile);

    return NextResponse.json({
      activeProfile: updated.activeProfile,
      profiles: updated.profiles,
    });
  } catch (error: any) {
    console.error('Trading profile POST error:', error?.message || error);
    return NextResponse.json({ error: 'Failed to update trading profile' }, { status: 500 });
  }
}
