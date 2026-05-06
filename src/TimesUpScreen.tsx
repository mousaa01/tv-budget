import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button, Modal } from './components';
import type { UseBudget } from './useBudget';
import { loadSettings } from './storage';

interface TimesUpProps {
  budgetCtl: UseBudget;
}

export function TimesUpScreen({ budgetCtl }: TimesUpProps) {
  const navigate = useNavigate();
  const [askingPin, setAskingPin] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const grant = (minutes: number) => {
    const settings = loadSettings();
    if (pin !== settings.pin) {
      setError('Wrong PIN');
      return;
    }
    budgetCtl.addBonusSeconds(minutes * 60);
    setAskingPin(false);
    setPin('');
    setError(null);
    navigate('/', { replace: true });
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)',
        textAlign: 'center',
      }}
    >
      <h1 className="t-display">You're all done for today!</h1>
      <p className="t-h2" style={{ color: 'var(--text-dim)' }}>
        Come back tomorrow for more.
      </p>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
        <Button autoFocus onClick={() => navigate('/', { replace: true })}>
          OK
        </Button>
        <Button variant="secondary" onClick={() => setAskingPin(true)}>
          Ask for bonus time
        </Button>
      </div>

      <Modal open={askingPin} onClose={() => { setAskingPin(false); setError(null); setPin(''); }} title="Parent PIN">
        <p className="t-body">Enter PIN to grant bonus time.</p>
        <input
          data-focusable
          autoFocus
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          type="password"
          inputMode="numeric"
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
        {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
        <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
          <Button variant="secondary" onClick={() => grant(10)}>+10 min</Button>
          <Button variant="secondary" onClick={() => grant(20)}>+20 min</Button>
          <Button onClick={() => grant(30)}>+30 min</Button>
        </div>
      </Modal>
    </div>
  );
}
