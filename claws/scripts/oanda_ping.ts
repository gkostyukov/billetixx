/*
  claws/scripts/oanda_ping.ts

  Мини-проверка, что профайл читается и OANDA отвечает.

  Usage (PowerShell):
    cd C:\Users\gkost\projects\WEB Projects\billetixx
    node --loader ts-node/esm claws/scripts/oanda_ping.ts --profile=default

  Profile file:
    claws/profiles/<profile>.json

  Expected profile format:
    {
      "env": "practice" | "live",
      "accountId": "...",
      "apiToken": "..."
    }
*/

import fs from 'fs';
import path from 'path';
import axios from 'axios';

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function main() {
  const profileName = arg('profile') || 'default';
  const profilePath = path.join(process.cwd(), 'claws', 'profiles', `${profileName}.json`);

  if (!fs.existsSync(profilePath)) {
    throw new Error(`Profile not found: claws/profiles/${profileName}.json`);
  }

  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8')) as {
    env: 'practice' | 'live';
    accountId: string;
    apiToken: string;
  };

  const baseURL = profile.env === 'live'
    ? 'https://api-fxtrade.oanda.com'
    : 'https://api-fxpractice.oanda.com';

  const client = axios.create({
    baseURL,
    headers: {
      Authorization: `Bearer ${profile.apiToken}`,
      'Content-Type': 'application/json',
    },
    timeout: 15_000,
  });

  const res = await client.get(`/v3/accounts/${profile.accountId}/summary`);
  const account = res.data?.account;
  console.log(JSON.stringify({
    ok: true,
    env: profile.env,
    accountId: profile.accountId,
    balance: account?.balance,
    NAV: account?.NAV,
    currency: account?.currency,
    openTradeCount: account?.openTradeCount,
    lastTransactionID: account?.lastTransactionID,
  }, null, 2));
}

main().catch((err) => {
  console.error('PING_FAILED', err?.response?.data || err?.message || err);
  process.exit(1);
});
