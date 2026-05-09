import { useEffect, useState } from 'react';
import { Button, Modal } from './components';
import { formatHMS } from './format';
import { buildAuthUrl, fetchSubscribedChannels, fetchUserProfile, isTokenValid } from './oauth';
import { clearSubscribedChannels, loadHistory, loadSettings, loadSubscribedChannels, saveSettings, saveSubscribedChannels } from './storage';
import type { Settings, SubscribedChannelsMeta } from './types';
import type { UseBudget } from './useBudget';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  budgetCtl: UseBudget;
}

export function SettingsModal({ open, onClose, budgetCtl }: SettingsModalProps) {
  const [authed, setAuthed] = useState(false);
  const [pinTry, setPinTry] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [blocklistInput, setBlocklistInput] = useState('');
  const [savedToast, setSavedToast] = useState(false);
  const [subscriptions, setSubscriptions] = useState<SubscribedChannelsMeta | null>(() => loadSubscribedChannels());
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleRefreshSubscriptions = async () => {
    const meta = loadSubscribedChannels();
    if (meta && isTokenValid(meta)) {
      setSyncing(true);
      setSyncError(null);
      try {
        const [channels, profile] = await Promise.all([
          fetchSubscribedChannels(meta.accessToken),
          fetchUserProfile(meta.accessToken),
        ]);
        const updated: SubscribedChannelsMeta = {
          ...meta,
          channels,
          profile: profile ?? meta.profile,
          syncedAt: new Date().toISOString(),
        };
        saveSubscribedChannels(updated);
        setSubscriptions(updated);
        setSavedToast(true);
        window.setTimeout(() => setSavedToast(false), 1500);
        if (channels.length === 0) {
          setSyncError('YouTube returned 0 channels. Subscriptions may be private in your account settings.');
        }
      } catch (err) {
        console.error('Sub refresh failed:', err);
        setSyncError(err instanceof Error ? err.message : String(err));
      } finally {
        setSyncing(false);
      }
    } else {
      // Token expired or missing — need Google login
      window.location.href = buildAuthUrl();
    }
  };

  useEffect(() => {
    if (open) {
      setAuthed(false);
      setPinTry('');
      setPinError(null);
      setSettings(loadSettings());
      setBlocklistInput('');
      setSubscriptions(loadSubscribedChannels());
    }
  }, [open]);

  const tryPin = () => {
    const current = loadSettings();
    if (pinTry === current.pin) {
      setAuthed(true);
      setPinError(null);
    } else {
      setPinError('Wrong PIN');
    }
  };

  const save = () => {
    const cleaned: Settings = {
      ...settings,
      dailyLimitMinutes: Math.max(15, Math.min(180, Math.round(settings.dailyLimitMinutes))),
    };
    saveSettings(cleaned);
    budgetCtl.refresh();
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1500);
  };

  const addBonus = (m: number) => {
    budgetCtl.addBonusSeconds(m * 60);
    setSavedToast(true);
    window.setTimeout(() => setSavedToast(false), 1500);
  };

  const addBlocklistKeyword = () => {
    const k = blocklistInput.trim().toLowerCase();
    if (!k) return;
    if (settings.blocklistKeywords.includes(k)) return;
    setSettings({ ...settings, blocklistKeywords: [...settings.blocklistKeywords, k] });
    setBlocklistInput('');
  };
  const removeBlocklistKeyword = (k: string) => {
    setSettings({ ...settings, blocklistKeywords: settings.blocklistKeywords.filter((x) => x !== k) });
  };

  const history = loadHistory().slice(0, 7);

  return (
    <Modal open={open} onClose={onClose} title="Settings">
      {!authed ? (
        <>
          <p className="t-body">Enter parent PIN.</p>
          <input
            data-focusable
            type="password"
            inputMode="numeric"
            value={pinTry}
            onChange={(e) => setPinTry(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && tryPin()}
            aria-label="PIN"
            style={{
              width: '100%',
              height: 80,
              padding: '0 var(--space-3)',
              background: 'var(--surface)',
              border: '4px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text)',
              fontSize: 32,
              letterSpacing: 8,
              textAlign: 'center',
            }}
          />
          {pinError && <div style={{ color: 'var(--danger)' }}>{pinError}</div>}
          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button onClick={tryPin}>Unlock</Button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {/* Daily limit */}
          <section>
            <h3 className="t-h2">Daily time limit</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <input
                data-focusable
                type="range"
                min={15}
                max={180}
                step={5}
                value={settings.dailyLimitMinutes}
                onChange={(e) => setSettings({ ...settings, dailyLimitMinutes: Number(e.target.value) })}
                style={{ flex: 1 }}
              />
              <div className="tabular t-h2" style={{ minWidth: 120, textAlign: 'right' }}>
                {settings.dailyLimitMinutes} min
              </div>
            </div>
          </section>

          {/* Bonus minutes */}
          <section>
            <h3 className="t-h2">Bonus minutes for today</h3>
            <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
              <Button variant="secondary" onClick={() => addBonus(10)}>+10</Button>
              <Button variant="secondary" onClick={() => addBonus(20)}>+20</Button>
              <Button variant="secondary" onClick={() => addBonus(30)}>+30</Button>
            </div>
          </section>

          {/* Blocklist */}
          <section>
            <h3 className="t-h2">Blocked keywords</h3>
            <div className="t-meta" style={{ marginBottom: 'var(--space-2)' }}>
              Search results with these words in the title are hidden.
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <input
                data-focusable
                value={blocklistInput}
                onChange={(e) => setBlocklistInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addBlocklistKeyword())}
                placeholder="e.g. prank"
                style={{
                  flex: 1,
                  height: 64,
                  padding: '0 var(--space-2)',
                  background: 'var(--surface)',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text)',
                  fontSize: 22,
                }}
              />
              <Button variant="secondary" onClick={addBlocklistKeyword}>Add</Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1)', marginTop: 'var(--space-2)' }}>
              {settings.blocklistKeywords.map((k) => (
                <button
                  key={k}
                  data-focusable
                  onClick={() => removeBlocklistKeyword(k)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 999,
                    border: '2px solid var(--border)',
                    color: 'var(--text)',
                    fontSize: 18,
                  }}
                >
                  {k} ✕
                </button>
              ))}
            </div>
          </section>

          {/* YouTube Account */}
          <section>
            <h3 className="t-h2">YouTube account</h3>
            {subscriptions ? (
              <>
                <div className="t-body" style={{ color: 'var(--ok)', marginTop: 'var(--space-2)' }}>
                  ✓ Connected — {subscriptions.channels.length} subscribed channels imported
                </div>
                <div className="t-meta" style={{ marginTop: 4 }}>
                  Last synced: {new Date(subscriptions.syncedAt).toLocaleDateString()}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                  <Button onClick={handleRefreshSubscriptions} disabled={syncing}>
                    {syncing ? 'Syncing…' : 'Refresh subscriptions'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => { clearSubscribedChannels(); setSubscriptions(null); }}
                  >
                    Disconnect
                  </Button>
                </div>
                {syncError && (
                  <div className="t-meta" style={{ color: 'var(--danger)', marginTop: 'var(--space-2)' }}>
                    ⚠ {syncError}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="t-meta" style={{ marginTop: 'var(--space-2)' }}>
                  Connect his YouTube account to automatically limit search to channels he subscribes to.
                </div>
                <div style={{ marginTop: 'var(--space-2)' }}>
                  <Button onClick={() => { window.location.href = buildAuthUrl(); }}>Connect YouTube account</Button>
                </div>
              </>
            )}
          </section>

          {/* Cool-down toggle */}
          <section>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <input
                data-focusable
                type="checkbox"
                checked={settings.coolDownEnabled}
                onChange={(e) => setSettings({ ...settings, coolDownEnabled: e.target.checked })}
                style={{ width: 32, height: 32 }}
              />
              <span className="t-h2">5-second cool-down between videos</span>
            </label>
          </section>

          {/* Change PIN */}
          <section>
            <h3 className="t-h2">PIN</h3>
            <input
              data-focusable
              type="text"
              inputMode="numeric"
              value={settings.pin}
              onChange={(e) => setSettings({ ...settings, pin: e.target.value })}
              style={{
                width: 200,
                height: 64,
                padding: '0 var(--space-2)',
                background: 'var(--surface)',
                border: '2px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                color: 'var(--text)',
                fontSize: 28,
                letterSpacing: 6,
                textAlign: 'center',
              }}
            />
          </section>

          {/* History */}
          <section>
            <h3 className="t-h2">Last 7 days</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'var(--space-2)' }}>
              <thead>
                <tr style={{ color: 'var(--text-dim)', fontSize: 18, textAlign: 'left' }}>
                  <th style={{ padding: 8 }}>Date</th>
                  <th style={{ padding: 8 }}>Time used</th>
                  <th style={{ padding: 8 }}>Videos</th>
                </tr>
              </thead>
              <tbody>
                {history.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="t-meta" style={{ padding: 8 }}>
                      No history yet.
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.date} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 8 }}>{h.date}</td>
                      <td className="tabular" style={{ padding: 8 }}>{formatHMS(h.secondsUsed)}</td>
                      <td className="tabular" style={{ padding: 8 }}>{h.videosWatched}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>

          <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end', marginTop: 'var(--space-3)' }}>
            <Button variant="secondary" onClick={onClose}>Close</Button>
            <Button onClick={save}>Save</Button>
          </div>

          {savedToast && (
            <div
              role="status"
              style={{
                position: 'fixed',
                bottom: 'var(--space-5)',
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--surface-2)',
                border: '2px solid var(--ok)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-2) var(--space-3)',
                color: 'var(--ok)',
                fontSize: 22,
                fontWeight: 600,
                zIndex: 400,
              }}
            >
              Saved
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
