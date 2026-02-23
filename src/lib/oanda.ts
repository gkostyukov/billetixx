/**
 * @file oanda.ts
 * @description OANDA REST API client factory.
 *
 * Provides a per-user authenticated axios client pointing to either
 * the OANDA practice (fxpractice) or live (fxtrade) environment,
 * based on the user's stored settings.
 *
 * Usage:
 *   ```ts
 *   const { client, accountId } = await getOandaClient(session.user.id);
 *   const res = await client.get(`/v3/accounts/${accountId}/openTrades`);
 *   ```
 */

import axios from 'axios';
import { prisma } from './prisma';

/**
 * Creates an authenticated OANDA API client for a given user.
 *
 * Reads the user's OANDA credentials from the database:
 * - `oandaEnvironment`       — "practice" | "live"
 * - `oandaPracticeAccountId` / `oandaPracticeToken`
 * - `oandaLiveAccountId`     / `oandaLiveToken`
 *
 * @param userId - The authenticated user's ID (from auth session).
 * @returns An object containing:
 *   - `client`    — Pre-configured axios instance with Authorization header
 *   - `accountId` — The OANDA account ID string for API calls
 *   - `isLive`    — Whether the live environment is active
 *
 * @throws {Error} "User not found" — if userId doesn't match any user record
 * @throws {Error} "Missing Practice/Live Oanda credentials" — if the required
 *   API token or account ID is null for the selected environment
 */
export async function getOandaClient(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            oandaEnvironment: true,
            oandaPracticeAccountId: true,
            oandaPracticeToken: true,
            oandaLiveAccountId: true,
            oandaLiveToken: true,
        }
    });

    if (!user) {
        throw new Error('User not found');
    }

    const isLive = user.oandaEnvironment === 'live';
    const accountId = isLive ? user.oandaLiveAccountId : user.oandaPracticeAccountId;
    const token = isLive ? user.oandaLiveToken : user.oandaPracticeToken;

    if (!accountId || !token) {
        throw new Error(`Missing ${isLive ? 'Live' : 'Practice'} Oanda credentials`);
    }

    /** OANDA REST API base URLs */
    const baseURL = isLive
        ? 'https://api-fxtrade.oanda.com'   // Live trading environment
        : 'https://api-fxpractice.oanda.com'; // Practice (demo) environment

    const client = axios.create({
        baseURL,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
    });

    return { client, accountId, isLive };
}
