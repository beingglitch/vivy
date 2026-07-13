'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      if (res.ok) {
        // Full navigation, not router.push: the client router may have cached
        // the "/ → /login" redirect from before the cookie existed.
        window.location.assign('/');
        return;
      }
      setError(res.status === 401 ? 'Wrong passcode.' : `Login failed (${res.status}).`);
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={submit} className="w-72 space-y-5">
        <div className="flex items-center justify-center gap-2.5">
          <span className="presence h-2.5 w-2.5 rounded-full bg-ember" aria-hidden />
          <h1 className="font-voice text-3xl italic tracking-wide text-linen">Vivy</h1>
        </div>
        <p className="font-voice text-center text-sm text-moth italic">
          Hello. It&apos;s you, right?
        </p>
        <input
          type="password"
          autoFocus
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          placeholder="Passcode"
          className="w-full rounded-lg border border-seam bg-veil px-3 py-2.5 text-linen placeholder:text-moth/50 outline-none transition-colors focus:border-ember/60"
        />
        {error && <p className="text-sm text-rose">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-ember py-2.5 font-medium text-night transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? 'Checking…' : 'Enter'}
        </button>
      </form>
    </main>
  );
}
