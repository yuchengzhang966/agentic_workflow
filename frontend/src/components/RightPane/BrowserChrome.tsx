import { ChevronLeftIcon, ChevronRightIcon, ExternalIcon, LockIcon } from '../icons';

export function BrowserChrome({ url }: { url: string | null }) {
  return (
    <div className="chrome">
      <button className="chrome__nav" disabled aria-label="Back">
        <ChevronLeftIcon size={16} />
      </button>
      <button className="chrome__nav" disabled aria-label="Forward">
        <ChevronRightIcon size={16} />
      </button>
      <div className="chrome__url">
        <LockIcon size={12} color="var(--text-muted)" />
        <span className="chrome__url-text">{url ?? ''}</span>
      </div>
      <button
        className="chrome__nav"
        disabled={!url}
        aria-label="Open in new tab"
        onClick={() => url && window.open(url, '_blank', 'noopener')}
      >
        <ExternalIcon size={15} />
      </button>
    </div>
  );
}
