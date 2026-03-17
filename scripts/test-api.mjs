#!/usr/bin/env node

/**
 * Local API Test Runner
 *
 * Usage:
 *   npm run test:api -- <endpoint> [method] [bodyJson]
 *
 * Examples:
 *   npm run test:api -- queue-status
 *   npm run test:api -- queue-worker POST
 *   npm run test:api -- cleanup-stuck-items
 *   npm run test:api -- sync-single-account POST '{"orgId":"x","projectId":"y","accountId":"z"}'
 *   npm run test:api -- queue-status GET '' http://localhost:3000
 *
 * The CRON_SECRET from .env.local is used for auth automatically.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const DEFAULTS = {
  baseUrl: 'http://localhost:3000',
  method: 'GET',
};

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env.local');
    const content = readFileSync(envPath, 'utf-8');
    const vars = {};
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      vars[key] = value;
    }
    return vars;
  } catch {
    return {};
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
  Local API Test Runner

  Usage:
    npm run test:api -- <endpoint> [method] [bodyJson] [baseUrl]

  Examples:
    npm run test:api -- queue-status
    npm run test:api -- queue-worker POST
    npm run test:api -- cleanup-stuck-items
    npm run test:api -- cron-orchestrator
    npm run test:api -- sync-single-account POST '{"orgId":"...","projectId":"...","accountId":"..."}'

  Available refresh-pipeline endpoints:
    queue-status           GET   Queue diagnostics
    queue-worker           POST  Process pending jobs
    cron-orchestrator      GET   Trigger full refresh
    cleanup-stuck-items    GET   Clean stuck items & locks
    process-organization   POST  Process one org (needs orgId)
    process-project        POST  Process one project (needs orgId, projectId, sessionId)
    sync-single-account    POST  Sync one account (needs orgId, projectId, accountId)
    process-single-video   POST  Process one video (needs videoId, orgId, projectId)
`);
    process.exit(0);
  }

  const endpoint = args[0].replace(/^\/?(api\/)?/, '');
  const method = (args[1] || DEFAULTS.method).toUpperCase();
  const bodyStr = args[2] || '';
  const baseUrl = args[3] || DEFAULTS.baseUrl;

  const env = loadEnv();
  const cronSecret = env.CRON_SECRET || 'local-dev-secret';

  const url = `${baseUrl}/api/${endpoint}`;

  const headers = {
    'Authorization': `Bearer ${cronSecret}`,
    'Content-Type': 'application/json',
  };

  const fetchOptions = { method, headers };

  if (method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = bodyStr || '{}';
  }

  console.log(`\n  ${method} ${url}`);
  console.log(`  Auth: Bearer ${cronSecret.slice(0, 8)}...`);
  if (fetchOptions.body) {
    console.log(`  Body: ${fetchOptions.body}`);
  }
  console.log('');

  const start = Date.now();

  try {
    const response = await fetch(url, fetchOptions);
    const elapsed = Date.now() - start;
    const contentType = response.headers.get('content-type') || '';

    console.log(`  Status: ${response.status} ${response.statusText}`);
    console.log(`  Time:   ${elapsed}ms\n`);

    if (contentType.includes('application/json')) {
      const json = await response.json();
      console.log(JSON.stringify(json, null, 2));
    } else {
      const text = await response.text();
      console.log(text);
    }
  } catch (err) {
    const elapsed = Date.now() - start;
    console.error(`  Error after ${elapsed}ms: ${err.message}`);

    if (err.cause?.code === 'ECONNREFUSED') {
      console.error(`\n  Is the local server running? Start it with: npm run dev`);
    }

    process.exit(1);
  }
}

main();
