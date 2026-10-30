'use client';

import { useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

const features = [
  ["01", "Create and manage", "Keep task details and progress in one place."],
  ["02", "Work together", "Assign tasks to registered teammates."],
  ["03", "Stay in sync", "Track pending, in progress, and completed work."],
  ["04", "Get notified", "Receive email when work is assigned or completed."],
];

export default function SignIn({ authError = "" }: { authError?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(authError);

  async function signIn() {
    if (loading) return;
    setLoading(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        scopes: "https://www.googleapis.com/auth/gmail.readonly",
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    if (authError) {
      setError(authError.message);
      setLoading(false);
    }
  }

  return (
    <main className="signin-shell">
      <section className="intro-panel">
        <Link className="brand" href="/" aria-label="Taskflow home"><span className="brand-mark">t</span> taskflow</Link>
        <div className="intro-copy">
          <p className="eyebrow">A calmer way to get things done</p>
          <h1>Make room for<br /><span>meaningful work.</span></h1>
          <p className="intro-description">A simple shared space to plan tasks, keep work moving, and know what needs your attention.</p>
          <div className="feature-list">
            {features.map(([number, title, description]) => (
              <div className="feature" key={number}>
                <span className="feature-number">{number}</span>
                <div><h2>{title}</h2><p>{description}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="intro-footer">Your work, thoughtfully organized.</p>
      </section>
      <section className="auth-panel" aria-labelledby="welcome-heading">
        <div className="auth-card">
          <span className="brand-mark auth-mark" aria-hidden="true">t</span>
          <p className="eyebrow">Welcome to taskflow</p>
          <h2 id="welcome-heading">Good work starts here.</h2>
          <p className="auth-description">Sign in to see your tasks and pick up where you left off.</p>
          <button className="google-button" type="button" onClick={signIn} disabled={loading}>
            {loading ? <span className="spinner" aria-hidden="true" /> : <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.28-1.93-6.15-4.53H2.16v2.84A11 11 0 0 0 12 23Z"/><path fill="#FBBC05" d="M5.85 14.11A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.35-2.11V7.05H2.16A11 11 0 0 0 1 12c0 1.78.43 3.46 1.16 4.95l3.69-2.84Z"/><path fill="#EA4335" d="M12 5.36c1.62 0 3.06.56 4.2 1.64l3.15-3.15C17.45 2.08 14.97 1 12 1a11 11 0 0 0-9.84 6.05l3.69 2.84c.87-2.6 3.29-4.53 6.15-4.53Z"/></svg>}
            {loading ? "Connecting to Google…" : "Continue with Google"}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          <p className="secure-note"><span aria-hidden="true">⌑</span> Secure sign-in, powered by Google</p>
        </div>
        <p className="auth-bottom">By continuing, you agree to use taskflow responsibly.</p>
      </section>
    </main>
  );
}



