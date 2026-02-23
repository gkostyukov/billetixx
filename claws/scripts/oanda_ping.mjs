/*
  claws/scripts/oanda_ping.mjs

  Мини-проверка, что профайл читается и OANDA отвечает.

  Usage (PowerShell):
    cd C:\Users\gkost\projects\WEB Projects\billetixx
    node claws/scripts/oanda_ping.mjs --profile=default

  Profile file:
    claws/profiles/<profile>.json

  Expected profile format:
    {
      "env": "practice" | "live",
      "accountId": "...",
      "apiToken": "..."
    }
*/

import fs from 'node:fs';
import path from 'node:path';
import axios from 'axios';

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

const profileName = arg('profile') || 'default';
const profilePath = path.join(process.cwd(), 'claws', 'profiles', `${profileName}.json`);

if (!fs.existsSync(profilePath)) {
  console.error(`Profile not found: claws/profiles/${profileName}.json`);
  process.exit(1);
}

const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

const baseURL = profile.env === 'live'
  ? 'https://api-fxtrade.oanda.com'
  : 'https://api-fxpractice.oanda.com';

const client = axios.create({
  baseURL,
  headers: {
    Authorization: `Bearer ${profile.apiToken}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

try {
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
} catch (err) {
  console.error('PING_FAILED', err?.response?.data || err?.message || err);
  process.exit(1);
}
