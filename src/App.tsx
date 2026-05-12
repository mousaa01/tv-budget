import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { BackgroundIllustrations } from './BackgroundIllustrations';
import { TimerOverlay } from './components';
import { HomeScreen } from './HomeScreen';
import { fetchSubscribedChannels, fetchUserProfile, parseTokenFromHash } from './oauth';
import { PlayerScreen } from './PlayerScreen';
import { loadSubscribedChannels, saveSubscribedChannels } from './storage';
import { SearchScreen } from './SearchScreen';
import { SettingsModal } from './SettingsModal';
import { SignInScreen, AccountBadge } from './SignInScreen';
import { TimesUpScreen } from './TimesUpScreen';
import type { SubscribedChannelsMeta } from './types';
import { useBudget } from './useBudget';

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
      {!onPlayer && (
        <AccountBadge
          name={auth.profile?.name ?? 'Signed in'}
          avatar={auth.profile?.avatar ?? ''}
          onClick={() => setSettingsOpen(true)}
        />
      )}

      <Routes>
        <Route
          path="/"
          element={
            <HomeScreen
              budgetCtl={budgetCtl}
              onOpenSettings={() => setSettingsOpen(true)}
            />
          }
        />
        <Route path="/search" element={<SearchScreen budgetCtl={budgetCtl} />} />
        <Route path="/play/:videoId" element={<PlayerScreen budgetCtl={budgetCtl} />} />
        <Route path="/timesup" element={<TimesUpScreen budgetCtl={budgetCtl} />} />
      </Routes>

      <SettingsModal
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          // Refresh auth state from storage in case user disconnected
          setAuth(loadSubscribedChannels());
        }}
        budgetCtl={budgetCtl}
      />
    </>
  );
}
