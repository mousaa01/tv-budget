import { useEffect, useState } from 'react';
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { TimerOverlay } from './components';
import { HomeScreen } from './HomeScreen';
import { fetchSubscribedChannels, parseTokenFromHash } from './oauth';
import { PlayerScreen } from './PlayerScreen';
import { saveSubscribedChannels } from './storage';
import { SearchScreen } from './SearchScreen';
import { SettingsModal } from './SettingsModal';
import { TimesUpScreen } from './TimesUpScreen';
import { useBudget } from './useBudget';

export default function App() {
  const budgetCtl = useBudget();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Handle OAuth implicit-grant redirect: Google appends #access_token=... to the URL.
  useEffect(() => {
    const token = parseTokenFromHash(window.location.hash);
    if (!token) return;
    // Clear the hash immediately so the token isn't visible in the URL bar.
    navigate('/', { replace: true });
    fetchSubscribedChannels(token)
      .then((channelIds) => {
        saveSubscribedChannels({ channelIds, syncedAt: new Date().toISOString() });
        // Open settings so the user can see the result.
        setSettingsOpen(true);
      })
      .catch((err: unknown) => {
        console.error('Failed to fetch subscriptions:', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hide the always-on timer on the player screen — the player draws its own
  // (same position, but rendered above the video).
  const onPlayer = location.pathname.startsWith('/play/');

  return (
    <>
      {!onPlayer && <TimerOverlay remainingSeconds={budgetCtl.remaining} />}
      {onPlayer && <TimerOverlay remainingSeconds={budgetCtl.remaining} />}

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
        onClose={() => setSettingsOpen(false)}
        budgetCtl={budgetCtl}
      />
    </>
  );
}
