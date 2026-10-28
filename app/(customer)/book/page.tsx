'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/site/Header';
import { Footer } from '@/components/site/Footer';
import { SignupForm } from '@/components/auth/SignupForm';

// The booking gate: a person who is not signed in creates an account right here
// (Google, or name / email / password and a code). A signed-in customer is sent
// on to My Vehicles by the form.
export default function BookGatePage() {
  const [googleMsg, setGoogleMsg] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Book a Service — AutoKita';

    const googleStatus = new URLSearchParams(window.location.search).get('google');
    if (googleStatus === 'cancelled') {
      setGoogleMsg('Google sign-in was cancelled.');
    } else if (googleStatus === 'failed') {
      setGoogleMsg("Google sign-in didn't work. Please try again.");
    } else if (googleStatus === 'not_allowed') {
      setGoogleMsg("This Google account can't sign in here. If you work at the shop, ask the owner to add your email.");
    } else if (googleStatus === 'unavailable') {
      setGoogleMsg("Google sign-in isn't available right now. You can sign up with your email below.");
    }
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />

      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-[28rem] rounded-xl border bg-card text-card-foreground shadow-sm">
          <div className="flex flex-col p-6 space-y-6">

            {/* Progress line */}
            <div className="flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span className="text-foreground">1 Account</span>
              <span className="opacity-50">/</span>
              <span>2 Vehicle</span>
              <span className="opacity-50">/</span>
              <span>3 Book</span>
            </div>

            {googleMsg && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive text-center">
                {googleMsg}
              </div>
            )}

            <SignupForm
              heading="Book a service"
              intro="Create your account first. Then add your car and pick a day and time."
            />
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
