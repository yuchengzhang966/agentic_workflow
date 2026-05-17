import type { Phase, RightTab } from '../lib/types';
import { CodeIcon, EyeIcon, HexIcon } from './icons';
import { StatusBadge } from './RightPane/StatusBadge';

interface Props {
  rightTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  onReset: () => void;
  canReset: boolean;
  phase: Phase;
}

export function AppHeader({ rightTab, onTabChange, onReset, canReset, phase }: Props) {
  return (
    <header className="header">
      <div className="header__brand">
        <HexIcon size={16} color="var(--accent-blue)" />
        Atoms Demo
      </div>

      <div className="header__tabs" role="tablist" aria-label="Right pane view">
        <button
          role="tab"
          aria-selected={rightTab === 'preview'}
          className={`header__tab ${rightTab === 'preview' ? 'header__tab--active' : ''}`}
          onClick={() => onTabChange('preview')}
        >
          <EyeIcon size={14} />
          Preview
        </button>
        <button
          role="tab"
          aria-selected={rightTab === 'code'}
          className={`header__tab ${rightTab === 'code' ? 'header__tab--active' : ''}`}
          onClick={() => onTabChange('code')}
        >
          <CodeIcon size={14} />
          Code
        </button>
      </div>

      <div className="header__spacer" />

      <StatusBadge phase={phase} />
      <button className="header__reset" onClick={onReset} disabled={!canReset}>
        Reset
      </button>
    </header>
  );
}
