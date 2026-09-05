"use client";

import { useEffect } from "react";
import { useApp } from "@/store/app-store";
import { LIVE_EVENT_INTERVAL_MS } from "@/lib/projectassure/events";
import LandingView from "./landing/landing-view";
import AboutView from "./about/about-view";
import LoginView from "./auth/login-view";
import AppShell from "./shell/app-shell";

export default function AppRoot() {
  const boot = useApp(s => s.boot);
  const route = useApp(s => s.route);
  const user = useApp(s => s.user);
  const applyNextEvent = useApp(s => s.applyNextEvent);
  const liveEventsEnabled = useApp(s => s.liveEventsEnabled);

  useEffect(() => { boot(); }, [boot]);

  // Portfolio heartbeat: deterministic live events drive toasts, badges & feeds
  useEffect(() => {
    if (!liveEventsEnabled || !user) return;
    const t = setInterval(() => applyNextEvent(), LIVE_EVENT_INTERVAL_MS);
    return () => clearInterval(t);
  }, [liveEventsEnabled, user, applyNextEvent]);

  // Guard: app pages require auth
  const page = route.page === "app" && !user ? "login" : route.page;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {page === "landing" && <LandingView />}
      {page === "about" && <AboutView />}
      {page === "login" && <LoginView />}
      {page === "app" && <AppShell portal={route.portal} />}
    </div>
  );
}
