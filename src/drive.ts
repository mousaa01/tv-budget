/**
 * Google Drive appDataFolder storage for TV-Budget settings.
 *
 * Settings are stored as a single JSON file named "tv-budget-settings.json"
 * in the user's Google Drive `appDataFolder` — a hidden, app-only space that
 * the user never sees in their regular Drive view.
 *
 * This lets parents update settings on any device (e.g. phone) and have them
 * sync automatically to the TV the next time the app is opened.
 *
 * All functions are best-effort: they never throw to the caller. If Drive is
 * unavailable (network offline, token lacks the scope, quota hit), the app
 * continues using localStorage silently.
 */
import type { Settings } from './types';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FILE_NAME = 'tv-budget-settings.json';
const FILE_ID_KEY = 'tv-budget:drive-file-id';

function getCachedFileId(): string | null {
  return localStorage.getItem(FILE_ID_KEY);
}
function setCachedFileId(id: string): void {
  localStorage.setItem(FILE_ID_KEY, id);
}

/**
 * Finds the settings file in appDataFolder, or creates it if it doesn't exist.
 * Caches the file ID in localStorage so we skip the list call on repeat uses.
 * Throws on network/API failure — callers should catch.
 */
async function resolveFileId(token: string): Promise<string> {
  const cached = getCachedFileId();
  if (cached) return cached;

  // Search for an existing file
  const listRes = await fetch(
    `${DRIVE_API}/files?spaces=appDataFolder&q=name%3D%27${FILE_NAME}%27&fields=files(id)`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!listRes.ok) throw new Error(`Drive list failed: ${listRes.status}`);
  const listData = (await listRes.json()) as { files: Array<{ id: string }> };
  if (listData.files.length > 0) {
    setCachedFileId(listData.files[0].id);
    return listData.files[0].id;
  }

  // Create the file (empty object as initial content)
  const boundary = 'tv_budget_drive_boundary';
  const metadata = JSON.stringify({ name: FILE_NAME, parents: ['appDataFolder'] });
  const body = [
    `--${boundary}`,
    'Content-Type: application/json; charset=UTF-8',
    '',
    metadata,
    `--${boundary}`,
    'Content-Type: application/json',
    '',
    '{}',
    `--${boundary}--`,
  ].join('\r\n');

  const createRes = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (!createRes.ok) throw new Error(`Drive create failed: ${createRes.status}`);
  const created = (await createRes.json()) as { id: string };
  setCachedFileId(created.id);
  return created.id;
}

/**
 * Loads settings from Drive. Returns null if Drive is unreachable or the
 * token doesn't have the drive.appdata scope (older tokens).
 */
export async function loadSettingsFromDrive(token: string): Promise<Partial<Settings> | null> {
  try {
    const fileId = await resolveFileId(token);
    const res = await fetch(`${DRIVE_API}/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text === '{}') return null;
    return JSON.parse(text) as Partial<Settings>;
  } catch (e) {
    console.warn('[drive] loadSettingsFromDrive failed (non-fatal):', e);
    return null;
  }
}

/**
 * Saves settings to Drive. Best-effort — failures are logged but not thrown.
 * Always call saveSettings() to localStorage first for instant local effect.
 */
export async function saveSettingsToDrive(token: string, settings: Settings): Promise<void> {
  try {
    const fileId = await resolveFileId(token);
    const res = await fetch(`${UPLOAD_API}/files/${fileId}?uploadType=media`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
    if (!res.ok) console.warn('[drive] saveSettingsToDrive failed:', res.status);
  } catch (e) {
    console.warn('[drive] saveSettingsToDrive failed (non-fatal):', e);
  }
}
