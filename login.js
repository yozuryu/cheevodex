import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { validateCredentials, getCredentials, clearCredentials } from './profile/utils/ra-api.js';

function LoginPage() {
  const [username, setUsername]     = useState('');
  const [apiKey, setApiKey]         = useState('');
  const [loading, setLoading]       = useState(false);
  const [checking, setChecking]     = useState(true);
  const [error, setError]           = useState('');
  const [showKey, setShowKey]       = useState(false);

  // Redirect immediately if already authenticated
  useEffect(() => {
    const creds = getCredentials();
    if (creds?.username && creds?.apiKey) {
      window.location.replace('./profile/');
    } else {
      setChecking(false);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const u = username.trim();
    const k = apiKey.trim();
    if (!u || !k) { setError('Please enter both your username and API key.'); return; }

    setLoading(true);
    setError('');

    try {
      await validateCredentials(u, k);
      localStorage.setItem('raCredentials', JSON.stringify({ username: u, apiKey: k }));
      window.location.replace('./profile/');
    } catch (err) {
      if (err.message === 'AUTH_ERROR') {
        setError('Invalid username or API key. Please check your credentials and try again.');
      } else {
        setError('Could not connect to RetroAchievements. Check your connection and try again.');
      }
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-line border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 py-12">
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .animate-spin { animation: spin 0.8s linear infinite; }
      `}</style>

      <div className="w-full max-w-sm">
        {/* Logo / branding */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img src="./assets/appicon.svg" alt="" className="w-16 h-16 rounded-[3px] shadow-[0_8px_24px_rgba(0,0,0,0.5)]" style={{ imageRendering: 'pixelated' }} />
          <h1 className="wm !text-[28px]">Cheevo<em>dex</em></h1>
          <p className="text-[11px] text-ink-3 uppercase tracking-[0.1em]">Register every unlock</p>
        </div>

        {/* Card */}
        <div className="bg-box border border-line rounded-[3px] shadow-xl p-6 flex flex-col gap-5">

          <div className="flex items-center gap-2 border-b border-line pb-4">
            <span className="sec-mark" />
            <span className="sec-t">Connect Account</span>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] text-ink-2 uppercase tracking-[0.1em] font-semibold">
                RA Username
              </label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck="false"
                disabled={loading}
                className="bg-well border border-line-2 hover:border-ink-3 focus:border-accent outline-none text-[12px] text-ink placeholder-ink-3 px-3 py-2 rounded-[2px] transition-colors disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] text-ink-2 uppercase tracking-[0.1em] font-semibold">
                  API Key
                </label>
                <a
                  href="https://retroachievements.org/settings"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-ink-3 hover:text-accent transition-colors uppercase tracking-wider"
                >
                  Get your key ↗
                </a>
              </div>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  autoComplete="current-password"
                  disabled={loading}
                  className="w-full bg-well border border-line-2 hover:border-ink-3 focus:border-accent outline-none text-[12px] text-ink placeholder-ink-3 px-3 py-2 pr-10 rounded-[2px] transition-colors disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-3 hover:text-ink-2 transition-colors text-[10px] select-none"
                  tabIndex={-1}
                >
                  {showKey ? 'hide' : 'show'}
                </button>
              </div>
              {/* How-to hint */}
              <div className="bg-bar border border-line rounded-[2px] px-3 py-2.5 flex flex-col gap-1.5 mt-0.5">
                <p className="text-[10px] text-ink-2 font-semibold uppercase tracking-[0.08em]">How to get your API key</p>
                <ol className="flex flex-col gap-1">
                  {[
                    <>Log in at <a href="https://retroachievements.org" target="_blank" rel="noreferrer" className="text-accent hover:text-ink transition-colors">retroachievements.org</a></>,
                    <>Go to <a href="https://retroachievements.org/settings" target="_blank" rel="noreferrer" className="text-accent hover:text-ink transition-colors">Settings</a> → <span className="text-ink">Keys</span> section</>,
                    <>Copy the value under <span className="text-ink">Web API Key</span></>,
                  ].map((step, i) => (
                    <li key={i} className="flex items-baseline gap-2 text-[10px] text-ink-3">
                      <span className="text-gold font-bold shrink-0">{i + 1}.</span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-hc/[0.08] border border-hc/30 rounded-[2px] px-3 py-2">
                <span className="text-hc text-[16px] leading-none shrink-0 mt-[1px]">!</span>
                <p className="text-[11px] text-hc leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !apiKey.trim()}
              className="flex items-center justify-center gap-2 bg-gold hover:bg-gold-press disabled:bg-disabled disabled:text-ink-3 text-well disabled:cursor-not-allowed font-bold text-[11px] uppercase tracking-[0.1em] px-4 py-2.5 rounded-[2px] transition-colors"
            >
              {loading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-ink-3 border-t-ink rounded-full animate-spin" />
                  Connecting…
                </>
              ) : (
                'Connect'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] text-ink-3 mt-5 leading-relaxed">
          Your API key is stored only in your browser's local storage<br/>and sent directly to RetroAchievements.
        </p>
        <p className="text-center text-[10px] text-ink-3 mt-3">Unofficial. Not affiliated with RetroAchievements.</p>
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<LoginPage />);
