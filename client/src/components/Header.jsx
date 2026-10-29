import { useState } from 'react';

export default function Header({ info, connected, view, onViewChange, onClear }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(info.captureUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (insecure context or permission denied); the URL is selectable.
    }
  }

  return (
    <header className="topbar">
      <div className="brand">
        <h1>Request Inspector</h1>
        <span className={connected ? 'status live' : 'status offline'}>
          <span className="dot" aria-hidden="true" />
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="url-pill">
        <span className="label">Send requests to</span>
        <code>{info ? info.captureUrl : '…'}</code>
        <button type="button" onClick={handleCopy} disabled={!info}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div className="topbar-actions">
        <div role="tablist" aria-label="View" className="tabs">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'requests'}
            onClick={() => onViewChange('requests')}
          >
            Requests
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'patterns'}
            onClick={() => onViewChange('patterns')}
          >
            Patterns
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'replies'}
            onClick={() => onViewChange('replies')}
          >
            Replies
          </button>
        </div>
        <button type="button" className="danger" onClick={onClear}>
          Clear all
        </button>
      </div>
    </header>
  );
}
