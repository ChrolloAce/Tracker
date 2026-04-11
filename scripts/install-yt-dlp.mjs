#!/usr/bin/env node
/**
 * Downloads the standalone yt-dlp binary into api/_bin/yt-dlp so it can
 * be spawned by the /api/analyze-video endpoint without needing a
 * Python runtime.
 *
 * Runs as `postinstall` in package.json, so it fires on:
 *   - Your local `npm install` on macOS → downloads yt-dlp_macos
 *   - Vercel's build `npm install` on Linux → downloads yt-dlp_linux
 *
 * Same path (api/_bin/yt-dlp) either way. The binary is gitignored so
 * your local Mac binary never gets pushed — Vercel always does its own
 * fresh postinstall and gets the right Linux build.
 *
 * Safe to re-run: if the target file already exists and is non-empty,
 * we skip the download.
 *
 * Override the platform target by setting YTDLP_TARGET=<linux|macos|linux_aarch64>.
 */

import { createWriteStream, existsSync, mkdirSync, statSync, chmodSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');
const binDir = join(repoRoot, 'api', '_bin');
const binPath = join(binDir, 'yt-dlp');

// Pick the right asset for the host OS/arch. Vercel's Node runtime is
// Linux x86-64, so that's what gets downloaded during `vercel build`.
function resolveAssetName() {
  const override = process.env.YTDLP_TARGET;
  if (override) {
    if (override === 'linux') return 'yt-dlp_linux';
    if (override === 'linux_aarch64') return 'yt-dlp_linux_aarch64';
    if (override === 'macos') return 'yt-dlp_macos';
    if (override === 'windows') return 'yt-dlp.exe';
    throw new Error(`Unknown YTDLP_TARGET: ${override}`);
  }

  const platform = process.platform;
  const arch = process.arch;

  if (platform === 'darwin') return 'yt-dlp_macos';
  if (platform === 'linux') {
    return arch === 'arm64' ? 'yt-dlp_linux_aarch64' : 'yt-dlp_linux';
  }
  if (platform === 'win32') return 'yt-dlp.exe';

  throw new Error(`Unsupported platform: ${platform} (${arch})`);
}

async function main() {
  if (!existsSync(binDir)) {
    mkdirSync(binDir, { recursive: true });
  }

  // Skip if already downloaded and non-empty.
  // Note: this intentionally does NOT check the binary's architecture
  // against the current platform. If you switched laptops or want to
  // force a re-download, just `rm api/_bin/yt-dlp` and re-run.
  if (existsSync(binPath)) {
    const size = statSync(binPath).size;
    if (size > 1_000_000) {
      console.log(
        `[install-yt-dlp] binary already present at ${binPath} (${(size / 1024 / 1024).toFixed(1)}MB) — skipping`,
      );
      return;
    }
  }

  const assetName = resolveAssetName();
  const downloadUrl = `https://github.com/yt-dlp/yt-dlp/releases/latest/download/${assetName}`;

  console.log(
    `[install-yt-dlp] platform=${process.platform} arch=${process.arch} → downloading ${assetName}…`,
  );

  const response = await fetch(downloadUrl, { redirect: 'follow' });
  if (!response.ok) {
    throw new Error(`Failed to download ${downloadUrl}: HTTP ${response.status}`);
  }
  if (!response.body) {
    throw new Error('Response body was empty');
  }

  await pipeline(response.body, createWriteStream(binPath));
  chmodSync(binPath, 0o755);

  const finalSize = statSync(binPath).size;
  console.log(`[install-yt-dlp] wrote ${binPath} (${(finalSize / 1024 / 1024).toFixed(1)}MB)`);
}

main().catch((err) => {
  console.error(`[install-yt-dlp] ${err.message || err}`);
  // Don't fail the install — we want `npm install` to succeed even if the
  // download hiccups (e.g. offline). The endpoint will surface a clean
  // error at call time if the binary is missing.
  process.exitCode = 0;
});
