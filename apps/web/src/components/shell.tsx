'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  AiIcon,
  FocusAreaIcon,
  HomeIcon,
  LearningIcon,
  MicIcon,
  MoneyIcon,
  MoreIcon,
  QuadrantIcon,
  SendIcon,
  TodayIcon,
} from './icons';

interface VoiceResultEvent {
  results: ArrayLike<{ 0?: { transcript?: string } }>;
}

interface VoiceRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: VoiceResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

type VoiceRecognitionConstructor = new () => VoiceRecognition;

/**
 * The persistent chrome: status bar, capture composer, tab bar.
 *
 * The composer sits above the tab bar on every screen rather than taking a tab
 * slot, which is what keeps capture one thumb-reach away, the whole premise of
 * a chat-first tracker. Both float over the scroll region on a white gradient,
 * so content scrolls under them instead of being clipped by them.
 *
 * There is deliberately no status bar. The design canvas drew one because a
 * mockup has to draw the whole phone, but on a real phone it is a second fake
 * clock sitting under the real one.
 */

const TABS = [
  { href: '/', label: 'Home', Icon: HomeIcon },
  { href: '/today', label: 'Today', Icon: TodayIcon },
  { href: '/quadrant', label: 'Quadrant', Icon: QuadrantIcon },
  { href: '/money', label: 'Money', Icon: MoneyIcon },
  { href: '/more/areas', label: 'Focus area', Icon: FocusAreaIcon },
  { href: '/learning', label: 'Learning', Icon: LearningIcon },
  { href: '/more', label: 'More', Icon: MoreIcon },
] as const;

export function TabBar() {
  const pathname = usePathname();

  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map(({ href, label, Icon }) => {
        // `/` must match exactly, or it would light up on every route.
        const active =
          href === '/'
            ? pathname === '/'
            : href === '/more'
              ? pathname === '/more' ||
                pathname.startsWith('/more/sources') ||
                pathname.startsWith('/more/settings')
              : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href as Route}
            className="tab"
            aria-current={active ? 'page' : undefined}
          >
            <span className="tab__icon">
              <Icon />
            </span>
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Capture bar.
 *
 * Typing turns the mic into a send button, the design shows both states, and
 * showing send on an empty field would offer an action that does nothing.
 */
export function Composer({
  placeholder = 'Tell Vivy…',
  onSubmit,
}: {
  placeholder?: string;
  /**
   * What to do with the typed text. Without one the field still clears, which
   * keeps it honest until the chat endpoint lands: a bar that swallows input
   * and reloads the page is worse than one that visibly does nothing.
   */
  onSubmit?: (text: string) => Promise<void> | void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [listening, setListening] = useState(false);
  const [activity, setActivity] = useState(0);
  const composer = useRef<HTMLFormElement>(null);
  const recognition = useRef<VoiceRecognition | null>(null);
  const longPressed = useRef(false);
  const press = useRef<{
    timer: ReturnType<typeof setTimeout>;
    x: number;
    y: number;
  } | null>(null);
  const hasText = value.trim().length > 0;

  function collapse() {
    recognition.current?.stop();
    recognition.current = null;
    setListening(false);
    setExpanded(false);
  }

  function startVoice() {
    setExpanded(true);
    setActivity((current) => current + 1);
    const voiceWindow = window as Window & {
      SpeechRecognition?: VoiceRecognitionConstructor;
      webkitSpeechRecognition?: VoiceRecognitionConstructor;
    };
    const VoiceInput = voiceWindow.SpeechRecognition ?? voiceWindow.webkitSpeechRecognition;
    if (!VoiceInput) return;

    recognition.current?.stop();
    const next = new VoiceInput();
    next.continuous = false;
    next.interimResults = false;
    next.lang = navigator.language || 'en-IN';
    next.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();
      if (transcript) {
        setValue((current) => `${current}${current ? ' ' : ''}${transcript}`);
        setActivity((current) => current + 1);
      }
    };
    next.onend = () => {
      recognition.current = null;
      setListening(false);
    };
    next.onerror = () => {
      recognition.current = null;
      setListening(false);
    };
    recognition.current = next;
    setListening(true);
    try {
      next.start();
    } catch {
      recognition.current = null;
      setListening(false);
    }
  }

  function stopPress() {
    if (!press.current) return;
    clearTimeout(press.current.timer);
    press.current = null;
  }

  useEffect(() => {
    if (!expanded) return;
    const dismiss = (event: PointerEvent) => {
      if (!composer.current?.contains(event.target as Node)) collapse();
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [expanded]);

  useEffect(() => {
    if (!expanded || listening) return;
    const timer = window.setTimeout(collapse, 8_000);
    return () => window.clearTimeout(timer);
  }, [activity, expanded, listening]);

  useEffect(
    () => () => {
      recognition.current?.stop();
      stopPress();
    },
    [],
  );

  return (
    <form
      ref={composer}
      className={`composer${expanded ? ' composer--expanded' : ' composer--collapsed'}${
        hasText ? ' composer--active' : ''
      }`}
      onSubmit={(e) => {
        e.preventDefault();
        const text = value.trim();
        if (!text || busy) return;
        // Cleared first so the field is ready for the next thought rather than
        // blocked on a round trip.
        setValue('');
        collapse();
        if (!onSubmit) return;
        setBusy(true);
        void Promise.resolve(onSubmit(text)).finally(() => setBusy(false));
      }}
    >
      {!expanded ? (
        <button
          type="button"
          className="composer__btn composer__btn--ai"
          aria-label="Open Vivy. Press and hold for voice input."
          onPointerDown={(event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            longPressed.current = false;
            press.current = {
              x: event.clientX,
              y: event.clientY,
              timer: setTimeout(() => {
                press.current = null;
                longPressed.current = true;
                navigator.vibrate?.(30);
                startVoice();
                window.setTimeout(() => {
                  longPressed.current = false;
                }, 700);
              }, 550),
            };
          }}
          onPointerMove={(event) => {
            if (!press.current) return;
            if (Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y) > 8) {
              stopPress();
            }
          }}
          onPointerUp={stopPress}
          onPointerCancel={stopPress}
          onContextMenu={(event) => event.preventDefault()}
          onClick={() => {
            if (longPressed.current) {
              longPressed.current = false;
              return;
            }
            setExpanded(true);
            setActivity((current) => current + 1);
          }}
        >
          <AiIcon />
        </button>
      ) : (
        <input
          className="composer__input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActivity((current) => current + 1);
          }}
          placeholder={listening ? 'Listening…' : placeholder}
          aria-label={placeholder}
          autoFocus
        />
      )}
      {expanded && hasText ? (
        <button type="submit" className="composer__btn composer__btn--solid" aria-label="Send">
          <SendIcon />
        </button>
      ) : expanded ? (
        <button
          type="button"
          className={`composer__btn composer__btn--solid${
            listening ? ' composer__btn--listening' : ''
          }`}
          aria-label={listening ? 'Stop voice input' : 'Start voice input'}
          onClick={() => {
            if (listening) {
              recognition.current?.stop();
              return;
            }
            startVoice();
          }}
        >
          <MicIcon />
        </button>
      ) : null}
    </form>
  );
}

export function Dock({ children }: { children?: React.ReactNode }) {
  return (
    <div className="dock">
      {children}
      <Composer />
      <TabBar />
    </div>
  );
}
