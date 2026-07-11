'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useChat } from '@ai-sdk/react';

// The bottom-right door to Vivy: a floating button on every page that opens a
// mini chat overlay. Voice-first — tap the mic, speak, stop. With Safety on you
// review the draft (say "go" to send, or speak a correction); with Safety off
// it sends the moment you stop talking.

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

function makeRecognition(): Recognition | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as Record<string, new () => Recognition>;
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

const ERROR_HINTS: Record<string, string> = {
  'not-allowed': 'Mic blocked — allow microphone access for this site.',
  'no-speech': "Didn't catch anything — tap the mic and try again.",
  'audio-capture': 'No microphone found.',
  network: 'Speech service unreachable — check the connection.',
};

type Phase = 'idle' | 'listening' | 'review' | 'commanding' | 'editing';

function loadSettings() {
  try {
    return { safety: true, speak: true, ...JSON.parse(localStorage.getItem('vivy-voice') ?? '{}') };
  } catch {
    return { safety: true, speak: true };
  }
}

export function VivyFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [interim, setInterim] = useState('');
  const [draft, setDraft] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [voiceOk, setVoiceOk] = useState(false);
  const [settings, setSettings] = useState({ safety: true, speak: true });
  const [showSettings, setShowSettings] = useState(false);

  const recRef = useRef<Recognition | null>(null);
  const commandRounds = useRef(0);
  const spokenIds = useRef(new Set<string>());
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, error: chatError } = useChat();
  const busy = status === 'submitted' || status === 'streaming';

  useEffect(() => {
    setSettings(loadSettings());
    setVoiceOk(Boolean(makeRecognition()));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase, status]);

  // Speak Vivy's finished replies aloud when enabled.
  useEffect(() => {
    if (!settings.speak || status !== 'ready' || !open) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== 'assistant' || spokenIds.current.has(last.id)) return;
    const t = last.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
    if (!t) return;
    spokenIds.current.add(last.id);
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(t);
      u.lang = 'en-IN';
      speechSynthesis.speak(u);
    } catch {}
  }, [messages, status, settings.speak, open]);

  function saveSettings(next: { safety: boolean; speak: boolean }) {
    setSettings(next);
    try {
      localStorage.setItem('vivy-voice', JSON.stringify(next));
    } catch {}
    if (!next.speak) speechSynthesis?.cancel();
  }

  const send = useCallback(
    (t: string) => {
      const clean = t.trim();
      if (!clean) return;
      recRef.current?.abort?.();
      setDraft('');
      setInterim('');
      setPhase('idle');
      sendMessage({ text: clean });
    },
    [sendMessage],
  );

  const startCommandListening = useCallback(
    (currentDraft: string) => {
      const rec = makeRecognition();
      if (!rec) return;
      recRef.current?.abort?.();
      recRef.current = rec;
      rec.lang = 'en-IN';
      rec.interimResults = false;
      rec.continuous = false;
      setPhase('commanding');
      let heard = '';
      rec.onresult = (e) => {
        heard = Array.from(e.results as ArrayLike<{ 0: { transcript: string } }>, (r) => r[0].transcript)
          .join(' ')
          .trim();
      };
      rec.onerror = (e) => {
        if (e.error && e.error !== 'no-speech' && e.error !== 'aborted') setError(ERROR_HINTS[e.error] ?? e.error);
      };
      rec.onend = () => {
        const cmd = heard.toLowerCase().replace(/[.!,?]/g, '').trim();
        if (!cmd) {
          // Silence while you read the draft — re-arm a couple of times, then rest.
          commandRounds.current += 1;
          if (commandRounds.current < 3) startCommandListening(currentDraft);
          else setPhase('review');
          return;
        }
        if (/^(go|send|yes|ok|okay|haan)( .*)?$/.test(cmd)) {
          send(currentDraft);
        } else if (/^(cancel|clear|no|nahi|stop|discard)( .*)?$/.test(cmd)) {
          setDraft('');
          setPhase('idle');
        } else {
          // An oral correction: let Haiku rewrite the draft.
          setPhase('editing');
          fetch('/api/voice-edit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ draft: currentDraft, instruction: heard }),
          })
            .then((r) => r.json())
            .then((j) => {
              const next = j.draft || currentDraft;
              setDraft(next);
              commandRounds.current = 0;
              startCommandListening(next);
            })
            .catch(() => {
              setError('Correction failed — edit by hand or say it again.');
              setPhase('review');
            });
        }
      };
      try {
        rec.start();
      } catch {
        setPhase('review');
      }
    },
    [send],
  );

  const startCapture = useCallback(() => {
    const rec = makeRecognition();
    if (!rec) return;
    recRef.current?.abort?.();
    recRef.current = rec;
    speechSynthesis?.cancel();
    rec.lang = 'en-IN';
    rec.interimResults = true;
    rec.continuous = false; // Chrome endpointing stops on ~a second of silence
    setError('');
    setInterim('');
    setPhase('listening');
    let finalText = '';
    rec.onresult = (e) => {
      let all = '';
      for (let i = 0; i < e.results.length; i++) {
        all += e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText = all;
      }
      setInterim(all);
    };
    rec.onerror = (e) => {
      if (e.error !== 'aborted') setError(ERROR_HINTS[e.error ?? ''] ?? `Mic error: ${e.error}`);
      setPhase('idle');
    };
    rec.onend = () => {
      const heard = (finalText || '').trim();
      setInterim('');
      if (!heard) {
        setPhase((p) => (p === 'listening' ? 'idle' : p));
        return;
      }
      if (loadSettings().safety) {
        setDraft(heard);
        setPhase('review');
        commandRounds.current = 0;
        startCommandListening(heard);
      } else {
        send(heard);
      }
    };
    try {
      rec.start();
    } catch {
      setError('Could not start the mic.');
      setPhase('idle');
    }
  }, [send, startCommandListening]);

  function stopEverything() {
    recRef.current?.abort?.();
    setPhase('idle');
    setInterim('');
  }

  if (pathname === '/login') return null;

  const lastFew = messages.slice(-6);
  const hint =
    phase === 'listening'
      ? 'Listening… speak, then pause.'
      : phase === 'commanding'
        ? 'Read it — say "go" to send, "cancel", or speak a correction.'
        : phase === 'editing'
          ? 'Fixing the draft…'
          : phase === 'review'
            ? 'Tap Go to send, ↻ to re-listen, ✕ to discard.'
            : busy
              ? 'Vivy is thinking…'
              : voiceOk
                ? 'Tap the mic and just talk.'
                : 'Voice needs Chrome — type below.';

  return (
    <>
      {open && (
        <div className="fixed right-4 bottom-20 z-50 flex max-h-[70vh] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-seam bg-night/95 shadow-2xl shadow-black/50 backdrop-blur">
          <div className="flex items-center gap-2 border-b border-seam/70 px-4 py-2.5">
            <span className="presence h-2 w-2 rounded-full bg-ember" aria-hidden />
            <span className="font-voice text-sm italic text-linen">Vivy</span>
            <button
              onClick={() => setShowSettings((v) => !v)}
              title="Voice settings"
              className="ml-auto text-xs text-moth transition-colors hover:text-linen"
            >
              ⚙
            </button>
            <button onClick={() => { stopEverything(); setOpen(false); }} className="text-xs text-moth hover:text-linen">
              ✕
            </button>
          </div>

          {showSettings && (
            <div className="flex gap-4 border-b border-seam/70 px-4 py-2 text-xs text-moth">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={settings.safety}
                  onChange={(e) => saveSettings({ ...settings, safety: e.target.checked })}
                />
                safety (confirm before send)
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={settings.speak}
                  onChange={(e) => saveSettings({ ...settings, speak: e.target.checked })}
                />
                speak replies
              </label>
            </div>
          )}

          <div className="min-h-24 flex-1 space-y-2 overflow-y-auto px-4 py-3">
            {lastFew.length === 0 && (
              <p className="font-voice pt-3 text-center text-sm text-linen/80 italic">
                Log spends, finish tasks, note reading — from anywhere.
              </p>
            )}
            {lastFew.map((m) => {
              const t = m.parts
                .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
                .map((p) => p.text)
                .join('');
              if (!t) return null;
              return m.role === 'user' ? (
                <p key={m.id} className="ml-8 rounded-xl rounded-br-sm bg-seam px-3 py-1.5 text-right text-xs text-linen">
                  {t}
                </p>
              ) : (
                <p key={m.id} className="font-voice mr-4 border-l-2 border-ember/70 pl-2.5 text-[13px] leading-6 text-linen/95 whitespace-pre-wrap">
                  {t}
                </p>
              );
            })}
            {chatError && <p className="text-xs text-rose">Something broke: {chatError.message}</p>}
            <div ref={bottomRef} />
          </div>

          {(phase === 'review' || phase === 'commanding' || phase === 'editing') && draft && (
            <div className="border-t border-seam/70 bg-veil/60 px-4 py-2.5">
              <p className="text-[10px] tracking-widest text-moth uppercase">You said</p>
              <p className="mt-1 text-sm leading-snug text-linen">{draft}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() => send(draft)}
                  className="rounded-lg bg-ember px-3.5 py-1 text-xs font-medium text-night hover:brightness-110"
                >
                  Go
                </button>
                <button
                  onClick={() => { commandRounds.current = 0; startCommandListening(draft); }}
                  title="Listen again for go / correction"
                  className="rounded-lg border border-seam px-2.5 py-1 text-xs text-moth hover:text-linen"
                >
                  ↻
                </button>
                <button
                  onClick={() => { recRef.current?.abort?.(); setDraft(''); setPhase('idle'); }}
                  className="ml-auto text-xs text-moth hover:text-rose"
                >
                  ✕ discard
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-seam/70 px-4 py-2.5">
            {interim && <p className="mb-1.5 text-xs text-linen/70 italic">{interim}</p>}
            <div className="flex items-center gap-2">
              {voiceOk && (
                <button
                  onClick={() => (phase === 'listening' ? stopEverything() : startCapture())}
                  title={phase === 'listening' ? 'Stop' : 'Speak'}
                  aria-pressed={phase === 'listening'}
                  className={`shrink-0 rounded-full border p-2.5 transition-colors ${
                    phase === 'listening' || phase === 'commanding'
                      ? 'presence border-ember/70 bg-ember/20 text-ember'
                      : 'border-seam text-moth hover:border-ember/60 hover:text-linen'
                  }`}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
                    <rect x="9" y="3" width="6" height="11" rx="3" />
                    <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(text);
                  setText('');
                }}
                className="flex min-w-0 flex-1 gap-2"
              >
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="or type…"
                  className="min-w-0 flex-1 rounded-lg border border-seam bg-veil px-2.5 py-1.5 text-xs text-linen placeholder:text-moth/50 outline-none focus:border-ember/60"
                />
                <button
                  disabled={busy || !text.trim()}
                  className="rounded-lg bg-ember px-3 py-1.5 text-xs font-medium text-night disabled:opacity-40"
                >
                  Send
                </button>
              </form>
            </div>
            <p className="mt-1.5 text-[10px] text-moth/70" aria-live="polite">
              {error || hint}
            </p>
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        title="Talk to Vivy"
        aria-expanded={open}
        className={`fixed right-4 bottom-4 z-50 flex h-13 w-13 items-center justify-center rounded-full border shadow-lg shadow-black/40 transition-all ${
          open
            ? 'border-ember bg-ember text-night'
            : 'presence border-seam bg-veil text-ember hover:border-ember/60'
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
        </svg>
      </button>
    </>
  );
}
