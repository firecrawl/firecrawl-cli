/**
 * Vendored from firecrawl/firecrawl-agent:.internal/cli/src/utils/manifest.ts
 *
 * Divergence from upstream: removed the "look for agent-manifest.json next to
 * the bundled CLI" branch — when this code runs inside the root firecrawl-cli
 * npm package there is no bundled manifest. `loadManifest()` always clones
 * the public agent repo into a tmp dir and reads the manifest from there,
 * which is exactly what `loadExternalManifestSync` already does.
 *
 * Keep in sync with upstream when the manifest schema evolves.
 */

import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { info } from './ui';

export interface TemplateEntry {
  id: string;
  name: string;
  description: string;
  path: string;
  requiredEnvVars: string[];
  optionalEnvVars: string[];
  envFile?: string;
  devCommand: string;
  deploy: string[];
}

export interface ModelEntry {
  id: string;
  name: string;
}

export interface ProviderEntry {
  id: string;
  name: string;
  envVar: string;
  hint: string;
  models: ModelEntry[];
  endpointEnvVar?: string;
}

export interface Manifest {
  version: number;
  templates: TemplateEntry[];
  providers: ProviderEntry[];
}

let cached: Manifest | null = null;
let cachedSourceRoot: string | null = null;

const DEFAULT_REMOTE = 'firecrawl/firecrawl-agent';

export function loadManifest(): Manifest {
  if (cached) return cached;
  const { manifest } = loadExternalManifestSync(DEFAULT_REMOTE);
  return manifest;
}

function cloneRepo(source: string, dest: string): void {
  const ghToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  // Try gh CLI first (handles private repos via gh auth)
  try {
    execSync(`gh repo clone ${source} "${dest}" -- --depth 1`, {
      stdio: 'pipe',
    });
    return;
  } catch {}

  // Fall back to git clone with token if available
  const cloneUrl = ghToken
    ? `https://${ghToken}@github.com/${source}.git`
    : `https://github.com/${source}.git`;
  execSync(`git clone --depth 1 ${cloneUrl} "${dest}"`, { stdio: 'pipe' });
}

function loadExternalManifestSync(source: string): {
  manifest: Manifest;
  sourceRoot: string;
} {
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fc-agent-'));
  try {
    cloneRepo(source, tmpDir);
  } catch {
    // Default remote is public once launched; until then, gh auth covers
    // insiders and everyone else sees this hint.
    throw new Error(
      `Could not clone ${source}. If the repo isn't public yet, authenticate with \`gh auth login\` or set GITHUB_TOKEN. Otherwise, check your network / git install.`
    );
  }
  const manifestPath = path.join(tmpDir, 'agent-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    // Upstream currently ships the manifest at `.internal/cli/agent-manifest.json`.
    // Fall back to that location so the scaffolder keeps working until the
    // manifest is promoted to repo root.
    const nestedPath = path.join(
      tmpDir,
      '.internal',
      'cli',
      'agent-manifest.json'
    );
    if (fs.existsSync(nestedPath)) {
      const manifest = JSON.parse(
        fs.readFileSync(nestedPath, 'utf-8')
      ) as Manifest;
      cached = manifest;
      cachedSourceRoot = tmpDir;
      return { manifest, sourceRoot: tmpDir };
    }
    throw new Error(`No agent-manifest.json found in ${source}`);
  }
  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8')
  ) as Manifest;
  cached = manifest;
  cachedSourceRoot = tmpDir;
  return { manifest, sourceRoot: tmpDir };
}

/**
 * Load manifest from an external GitHub repo or local path.
 * Returns the manifest and the root directory where templates live.
 *
 * Supported sources:
 *   - "user/repo" — clones from GitHub, reads agent-manifest.json
 *   - "/absolute/path" or "./relative" — reads from local directory
 */
export async function loadExternalManifest(source: string): Promise<{
  manifest: Manifest;
  sourceRoot: string;
}> {
  // Local path
  if (source.startsWith('/') || source.startsWith('.')) {
    const absPath = path.resolve(source);
    const manifestPath = path.join(absPath, 'agent-manifest.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(
        fs.readFileSync(manifestPath, 'utf-8')
      ) as Manifest;
      cached = manifest;
      cachedSourceRoot = absPath;
      return { manifest, sourceRoot: absPath };
    }
    // Same upstream fallback as the remote clone path: while the manifest
    // lives under `.internal/cli/` rather than repo root, still accept
    // local agent-repo checkouts. Source root stays at repo root so
    // templates resolve correctly.
    const nestedPath = path.join(
      absPath,
      '.internal',
      'cli',
      'agent-manifest.json'
    );
    if (fs.existsSync(nestedPath)) {
      const manifest = JSON.parse(
        fs.readFileSync(nestedPath, 'utf-8')
      ) as Manifest;
      cached = manifest;
      cachedSourceRoot = absPath;
      return { manifest, sourceRoot: absPath };
    }
    throw new Error(`No agent-manifest.json found in ${absPath}`);
  }

  // GitHub repo (user/repo format)
  const tmpDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'fc-agent-'));
  info(`Cloning ${source}...`);
  try {
    cloneRepo(source, tmpDir);
  } catch {
    throw new Error(
      `Failed to clone ${source} - for private repos, install the gh CLI (gh auth login) or set GITHUB_TOKEN`
    );
  }

  const manifestPath = path.join(tmpDir, 'agent-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`No agent-manifest.json found in ${source}`);
  }

  const manifest = JSON.parse(
    fs.readFileSync(manifestPath, 'utf-8')
  ) as Manifest;
  cached = manifest;
  cachedSourceRoot = tmpDir;
  return { manifest, sourceRoot: tmpDir };
}

export function getSourceRoot(): string {
  if (cachedSourceRoot) return cachedSourceRoot;
  loadManifest();
  return cachedSourceRoot!;
}

export function getTemplates(): TemplateEntry[] {
  return (cached ?? loadManifest()).templates;
}

export function getTemplate(id: string): TemplateEntry | undefined {
  return getTemplates().find((t) => t.id === id);
}

export function getProviders(): ProviderEntry[] {
  return (cached ?? loadManifest()).providers;
}
