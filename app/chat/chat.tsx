'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';

type HistoryMessage = { id: string; role: 'user' | 'assistant'; text: string };

// Her messages read like a letter — serif, ember seam. Yours stay quiet sans.
function MessageBubble({ role, text }: { role: string; text: string }) {
  const mine = role === 'user';
  if (mine) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-seam px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap text-linen">
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="font-voice max-w-[85%] border-l-2 border-ember/70 py-1 pl-4 text-[15px] leading-7 whitespace-pre-wrap text-linen/95">
        {text}
      </div>
    </div>
  );
}

export function Chat({ history }: { history: HistoryMessage[] }) {
  const [input, setInput] = useState('');
  const { messages, sendMessage, status, error } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  const busy = status === 'submitted' || status === 'streaming';

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    sendMessage({ text });
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        {history.length === 0 && messages.length === 0 && (
          <div className="pt-16 text-center">
            <p className="font-voice text-lg text-linen/90 italic">Talk to me.</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-moth">
              I can manage your tasks, log your reading and spending, search your timeline, and
              remember what matters.
            </p>
          </div>
        )}
        {history.map((m) => (
          <MessageBubble key={m.id} role={m.role} text={m.text} />
        ))}
        {messages.map((m) => {
          const text = m.parts
            .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
            .map((p) => p.text)
            .join('');
          // Tool-call-only steps have no text yet — don't render empty bubbles.
          if (!text) return null;
          return <MessageBubble key={m.id} role={m.role} text={text} />;
        })}
        {status === 'submitted' && (
          <p className="flex items-center gap-2 text-sm text-moth">
            <span className="presence h-1.5 w-1.5 rounded-full bg-ember" aria-hidden />
            thinking…
          </p>
        )}
        {error && <p className="text-sm text-rose">Something broke: {error.message}</p>}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={submit} className="flex gap-2 border-t border-seam/70 pt-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Vivy…"
          autoFocus
          className="flex-1 rounded-lg border border-seam bg-veil px-3 py-2 text-sm text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60"
        />
        <button
          disabled={busy || !input.trim()}
          className="rounded-lg bg-ember px-4 py-2 text-sm font-medium text-night transition hover:brightness-110 disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
