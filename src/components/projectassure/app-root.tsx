"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app-store";
import { LIVE_EVENT_INTERVAL_MS } from "@/lib/projectassure/events";
import LandingView from "./landing/landing-view";
import AboutView from "./about/about-view";
import LoginView from "./auth/login-view";
import AppShell from "./shell/app-shell";
import DemoView from "./auth/demo-view";
import PublicView from "./public/public-view";
import ForgotPasswordView from "./auth/forgot-password-view";
import ResetPasswordView from "./auth/reset-password-view";

export default function AppRoot() {
  const boot = useApp(s => s.boot);
  const route = useApp(s => s.route);
  const user = useApp(s => s.user);
  const applyNextEvent = useApp(s => s.applyNextEvent);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);
  const syncNow = useApp(s => s.syncNow);

  useEffect(() => { boot(); }, [boot]);

  // Portfolio heartbeat: deterministic live events drive toasts, badges & feeds
  useEffect(() => {
    if (!liveEventsEnabled || !user) return;
    const t = setInterval(() => applyNextEvent(), LIVE_EVENT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [liveEventsEnabled, user, applyNextEvent]);

  // v21: periodic sync (every 45s) keeps the Host Control mirror warm while
  // a session is open, even without user mutations.
  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => void syncNow(true), 45000);
    return () => clearInterval(t);
  }, [user, syncNow]);

  // Guard: app pages require auth. #/demo, #/public, #/forgot, #/reset stay open to everyone.
  const page = route.page === "app" && !user ? "login" : route.page;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {page === "landing" && <LandingView />}
      {page === "about" && <AboutView />}
      {page === "login" && <LoginView />}
      {page === "demo" && <DemoView />}
      {page === "public" && <PublicView />}
      {page === "forgot" && <ForgotPasswordView />}
      {page === "reset" && <ResetPasswordView token={route.resetToken ?? ""} />}
      {page === "app" && <AppShell portal={route.portal} />}
    </div>
  );
}
