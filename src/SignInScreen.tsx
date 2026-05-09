import { Button } from './components';
import { buildAuthUrl } from './oauth';

interface SignInScreenProps {
  error?: string | null;
}

export function SignInScreen({ error }: SignInScreenProps) {
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
      <h1 className="t-display" style={{ color: 'var(--accent)' }}>
        <span className="wiggle" style={{ display: 'inline-block', marginRight: 12 }}>🍎</span>
        Adam's Apple
      </h1>
      <p className="t-h2" style={{ color: 'var(--text-dim)', maxWidth: 700 }}>
        Sign in with your YouTube account to get started!
      </p>
      <p className="t-body" style={{ color: 'var(--text-dim)', maxWidth: 700 }}>
        We'll show videos from the channels you're subscribed to.
      </p>
      <div
        style={{
          maxWidth: 700,
          padding: '14px 20px',
          background: 'rgba(6,182,212,0.10)',
          border: '2px solid rgba(6,182,212,0.35)',
          borderRadius: 'var(--radius-md)',
          fontSize: 18,
          lineHeight: 1.5,
          color: 'var(--text)',
          textAlign: 'left',
        }}
      >
        <strong>Tip:</strong> on the Google sign-in screen, choose your <em>personal</em> YouTube
        account — not a brand channel. Brand channels store their own subscriptions separately and
        won't show what you expect. Newly created channels can also take up to 24 hours before
        their subscriptions appear here (a YouTube API limitation).
      </div>
      <Button
        autoFocus
        onClick={() => {
          window.location.href = buildAuthUrl();
        }}
      >
        🔑 Sign in with YouTube
      </Button>
      {error && (
        <div
          className="t-body"
          style={{ color: 'var(--danger)', maxWidth: 700, marginTop: 'var(--space-2)' }}
        >
          ⚠ {error}
        </div>
      )}
    </div>
  );
}

interface AccountBadgeProps {
  name: string;
  avatar: string;
  onClick?: () => void;
}

export function AccountBadge({ name, avatar, onClick }: AccountBadgeProps) {
  return (
    <button
      data-focusable
      onClick={onClick}
      title={name}
      aria-label={`Signed in as ${name}`}
      style={{
        position: 'fixed',
        top: 'var(--space-3)',
        right: 'var(--space-4)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '6px 14px 6px 6px',
        background: 'rgba(255,255,255,0.85)',
        border: '2px solid rgba(30,27,75,0.15)',
        borderRadius: 999,
        zIndex: 100,
        cursor: 'pointer',
      }}
    >
      <img
        src={avatar}
        alt=""
        onError={(e) => { e.currentTarget.style.display = 'none'; }}
        style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          objectFit: 'cover',
          background: 'var(--surface-2)',
        }}
      />
      {!avatar && (
        <span style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'linear-gradient(135deg,#f97316,#ec4899)',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22,
        }}>👤</span>
      )}
      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {name}
      </span>
    </button>
  );
}
