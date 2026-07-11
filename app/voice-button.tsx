'use client';

import { useEffect, useRef, useState } from 'react';

// Browser speech-to-text (Web Speech API). Renders nothing where unsupported.
// Tap to listen, tap again to stop; the transcript lands via onText.
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort?: () => void;
};

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const recRef = useRef<Recognition | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  useEffect(() => {
    const w = window as unknown as Record<string, new () => Recognition>;
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = 'en-IN';
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = (e) => {
      const text = Array.from(e.results, (r) => r[0].transcript).join(' ').trim();
      if (text) onTextRef.current(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    setSupported(true);
    return () => rec.abort?.();
  }, []);

  if (!supported) return null;

  function toggle() {
    const rec = recRef.current;
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
    } else {
      rec.start();
      setListening(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? 'Stop listening' : 'Speak instead of typing'}
      aria-pressed={listening}
      className={`shrink-0 rounded-lg border px-2.5 transition-colors ${
        listening
          ? 'presence border-ember/70 bg-ember/15 text-ember'
          : 'border-seam text-moth hover:border-ember/60 hover:text-linen'
      }`}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
    </button>
  );
}
