import { useState } from 'react';
import { apiPost, setToken } from '../lib/api';

export function AuthPanel({ onAuthed }: { onAuthed: () => void }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const requestCode = async () => {
    setError('');
    try {
      const res = await apiPost<{ message: string; dev_code?: string }>('/api/auth/request-code', { email });
      setMessage(res.dev_code ? `${res.message} Dev code: ${res.dev_code}` : res.message);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send code');
    }
  };

  const verifyCode = async () => {
    setError('');
    try {
      const res = await apiPost<{ token: string }>('/api/auth/verify-code', { email, code });
      setToken(res.token);
      onAuthed();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify code');
    }
  };

  return (
    <div className="mx-auto mt-24 max-w-md rounded border border-slate-800 bg-slate-900 p-6">
      <h1 className="mb-4 text-xl font-semibold">AgentLens Login</h1>
      <p className="mb-4 text-sm text-slate-300">Вход по почте: получите код и подтвердите вход.</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mb-3 w-full rounded bg-slate-950 p-2"
      />
      {step === 'code' && (
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" className="mb-3 w-full rounded bg-slate-950 p-2" />
      )}
      {step === 'email' ? (
        <button onClick={requestCode} className="w-full rounded bg-indigo-600 p-2">Send code</button>
      ) : (
        <button onClick={verifyCode} className="w-full rounded bg-emerald-600 p-2">Verify & login</button>
      )}
      {message && <p className="mt-3 text-xs text-slate-400">{message}</p>}
      {error && <p className="mt-2 text-xs text-rose-400">{error}</p>}
    </div>
  );
}
