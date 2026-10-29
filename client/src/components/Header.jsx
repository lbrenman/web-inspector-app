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
    <header className="header">
      <div className="title-row">
        <h1>Request Inspector</h1>
        <span className={connected ? 'status live' : 'status offline'}>
          {connected ? 'Live' : 'Reconnecting…'}
        </span>
      </div>

      <div className="capture-url">
        <span>Send requests to:</span>
        <code>{info ? info.captureUrl : '…'}</code>
        <button type="button" onClick={handleCopy} disabled={!info}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <nav className="toolbar">
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
        </div>
        <button type="button" onClick={onClear}>
          Clear all
        </button>
      </nav>
    </header>
  );
}
