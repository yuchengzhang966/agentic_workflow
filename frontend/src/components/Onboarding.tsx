import { useState, type KeyboardEvent } from 'react';
import { HexIcon, ArrowRightIcon } from './icons';

const EXAMPLES = [
  'a habit tracker with daily streaks',
  'a personal expense tracker',
  'a markdown note-taking app',
  'a URL bookmark manager',
];

interface Props {
  onStart: (idea: string) => void;
}

/** Full-screen first-run prompt — shown until the first idea is submitted. */
export function Onboarding({ onStart }: Props) {
  const [idea, setIdea] = useState('');

  const submit = () => {
    const trimmed = idea.trim();
    if (trimmed) onStart(trimmed);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="onboard">
      <div className="onboard__inner">
        <div className="onboard__brand">
          <HexIcon size={20} color="var(--accent-blue)" />
          <span>Atoms Demo</span>
        </div>

        <h1 className="onboard__title">What do you want to build?</h1>
        <p className="onboard__sub">
          Describe an idea — an AI agent team will research it, draft a PRD for your
          approval, build the app, deploy it to a live sandbox, and review it.
        </p>

        <div className="onboard__box">
          <textarea
            className="onboard__input"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="e.g. a habit tracker with daily streaks"
            rows={3}
            autoFocus
          />
          <button className="onboard__submit" onClick={submit} disabled={!idea.trim()}>
            Build it
            <ArrowRightIcon size={16} />
          </button>
        </div>

        <div className="onboard__examples">
          <span className="onboard__examples-label">Try:</span>
          {EXAMPLES.map((ex) => (
            <button key={ex} className="onboard__example" onClick={() => setIdea(ex)}>
              {ex}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
