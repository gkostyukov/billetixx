/**
 * proxy.ts — i18n locale routing (next-intl, Next.js 15)
 *
 * Matches all page routes except:
 * - /api/* (API routes)
 * - /_next/* (Next.js internals)
 * - Static files with extensions (favicon.ico, images, etc.)
 */
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
    matcher: [
        // Match all paths except API routes, Next.js internals, and static files
        '/((?!api|_next|_vercel|.*\\..*).*)',
    ]
};
