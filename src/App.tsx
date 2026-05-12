import { lazy, Suspense, useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BackgroundIllustrations } from './BackgroundIllustrations';
import { Button, FiveMinuteWarning, LoadingDots, TimerOverlay } from './components';
import { HomeScreen } from './HomeScreen';
import { buildAuthUrl, fetchSubscribedChannels, fetchUserProfile, parseTokenFromHash } from './oauth';
import { clearSubscribedChannels, loadSubscribedChannels, saveSubscribedChannels } from './storage';
import { SignInScreen, AccountBadge } from './SignInScreen';
import { TimesUpScreen } from './TimesUpScreen';
import type { SubscribedChannelsMeta } from './types';
import { useBudget } from './useBudget';

const PlayerScreen = lazy(() => import('./PlayerScreen').then((m) => ({ default: m.PlayerScreen })));
const SearchScreen = lazy(() => import('./SearchScreen').then((m) => ({ default: m.SearchScreen })));
const SettingsModal = lazy(() => import('./SettingsModal').then((m) => ({ default: m.SettingsModal })));

export default function App() {
  const budgetCtl = useBudget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [auth, setAuth] = useState<SubscribedChannelsMeta | null>(() => loadSubscribedChannels());
  const [authError, setAuthError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle OAuth implicit-grant redirect: Google appends #access_token=... to the URL.
  useEffect(() => {
    const parsed = parseTokenFromHash(window.location.hash);
    if (!parsed) return;
    // Clear the hash immediately so the token isn't visible in the URL bar.
    navigate('/', { replace: true });

    (async () => {
      try {
        const [channels, profile] = await Promise.all([
          fetchSubscribedChannels(parsed.token),
          fetchUserProfile(parsed.token),
        ]);
        const meta: SubscribedChannelsMeta = {
          channels,
          syncedAt: new Date().toISOString(),
          accessToken: parsed.token,
          tokenExpiresAt: parsed.expiresAt,
          profile: profile ?? undefined,
        };
        saveSubscribedChannels(meta);
        setAuth(meta);
        if (channels.length === 0) {
          setAuthError(
            "Signed in, but YouTube returned 0 subscribed channels. Your subscriptions may be set to private in your YouTube account settings.",
          );
        } else {
          setAuthError(null);
        }
      } catch (err) {
        console.error('OAuth fetch failed:', err);
        setAuthError(err instanceof Error ? err.message : String(err));
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  // Auto-close settings whenever route changes — prevents the modal from
  // bleeding into the player screen (which used to leave half the screen white).
  useEffect(() => {
    setSettingsOpen(false);
  }, [location.pathname]);

  // Sign-in gate: no auth yet → show sign-in landing
  if (!auth) {
    return <SignInScreen error={authError} />;
  }

  const onPlayer = location.pathname.startsWith('/play/');

  return (
    <>
      <BackgroundIllustrations />
      <TimerOverlay remainingSeconds={budgetCtl.remaining} />
      <FiveMinuteWarning trigger={budgetCtl.fiveMinuteWarning} />
      {!onPlayer && (
        <AccountBadge
          name={auth.profile?.name ?? 'Signed in'}
          avatar={auth.profile?.avatar ?? ''}
          onClick={() => {
            // Switch account: clear current auth and re-launch OAuth flow.
            const ok = window.confirm(`Sign out of ${auth.profile?.name ?? 'this account'} and switch to a different YouTube account?`);
            if (!ok) return;
            clearSubscribedChannels();
            window.location.href = buildAuthUrl();
          }}
        />
      )}
      {!onPlayer && (
        <div style={{ position: 'fixed', right: 'var(--space-4)', bottom: 'var(--space-4)', zIndex: 100 }}>
          <Button variant="secondary" onClick={() => setSettingsOpen(true)}>
            ⚙ Settings
          </Button>
        </div>
      )}

      <Routes>
        <Route
          path="/"
          element={
            <HomeScreen
              budgetCtl={budgetCtl}
            />
          }
        />
        <Route
          path="/search"
          element={
            <Suspense fallback={<LoadingDots />}>
              <SearchScreen budgetCtl={budgetCtl} />
            </Suspense>
          }
        />
        <Route
          path="/play/:videoId"
          element={
            <Suspense fallback={<LoadingDots />}>
              <PlayerScreen budgetCtl={budgetCtl} />
            </Suspense>
          }
        />
        <Route path="/timesup" element={<TimesUpScreen budgetCtl={budgetCtl} />} />
      </Routes>

      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            open={settingsOpen}
            onClose={() => {
              setSettingsOpen(false);
              // Refresh auth state from storage in case user disconnected
              setAuth(loadSubscribedChannels());
            }}
            budgetCtl={budgetCtl}
          />
        </Suspense>
      )}
    </>
  );
}
