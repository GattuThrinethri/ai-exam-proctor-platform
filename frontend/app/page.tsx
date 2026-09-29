"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserCheck, BookOpen, Activity, LogIn, LogOut, ArrowRight } from "lucide-react";
import { authService, AuthUser } from "../services/auth";
import LanguageSelector from "../components/layout/LanguageSelector";
import { useLanguage } from "../i18n";

export default function Home() {
  const { t } = useLanguage();
  const [backendHealth, setBackendHealth] = useState<{
    status: string;
    database: string;
    version: string;
  } | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    // Check local authentication
    const user = authService.getUser();
    setCurrentUser(user);

    // Check backend health
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setBackendHealth(data);
        setLoadingHealth(false);
      })
      .catch((err) => {
        console.error("Health check error:", err);
        setBackendHealth({
          status: "unavailable",
          database: "unreachable",
          version: "unknown",
        });
        setLoadingHealth(false);
      });
  }, []);

  const handleLogout = () => {
    authService.logout();
    setCurrentUser(null);
  };

  const getPortalHref = (role: "student" | "examiner" | "admin") => {
    if (!currentUser) {
      return `/login?role=${role}`;
    }
    if (role === "student") return "/student";
    if (role === "examiner") return "/examiner";
    if (role === "admin") return "/admin";
    return "/login";
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-16 bg-[#0B132B] text-slate-100">
      {/* Top Bar */}
      <div className="z-10 max-w-6xl w-full items-center justify-between flex flex-wrap gap-4 font-mono text-sm">
        <div className="flex items-center space-x-2 bg-[#131D33] px-4 py-2 rounded-xl border border-slate-800 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-teal-400" />
          <span className="font-semibold text-slate-100">
            {t("common.appName")}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Multilingual Selector */}
          <LanguageSelector />

          {/* Health status */}
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-xs text-slate-400 font-medium">Backend &amp; DB:</span>
            {loadingHealth ? (
              <span className="px-2 py-0.5 text-xs bg-slate-800 text-slate-400 rounded-full animate-pulse">
                {t("common.loading")}
              </span>
            ) : backendHealth?.status === "healthy" ? (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-950/60 text-emerald-300 rounded-full flex items-center gap-1.5 border border-emerald-800/60">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                {t("common.online")}
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-950/60 text-amber-300 rounded-full border border-amber-800/60">
                {t("common.status")}: {backendHealth?.status || t("common.loading")}
              </span>
            )}
          </div>

          {/* Auth indicator */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-[#131D33] px-3 py-1.5 rounded-xl border border-slate-800 shadow-sm">
              <div className="text-xs">
                <span className="font-semibold text-slate-100">{currentUser.name}</span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-teal-400 border border-slate-700">
                  {currentUser.role}
                </span>
              </div>
              <Link
                href={
                  currentUser.role === "admin"
                    ? "/admin"
                    : currentUser.role === "examiner"
                    ? "/examiner"
                    : "/student"
                }
                className="px-2.5 py-1 text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-lg transition-colors"
              >
                {t("nav.dashboard")}
              </Link>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-rose-400 rounded transition-colors"
                title={t("common.logout")}
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-200 bg-[#131D33] border border-slate-700 rounded-xl hover:bg-slate-800 shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-teal-400" />
                {t("common.signIn")}
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 shadow-sm transition-colors"
              >
                {t("auth.registerTitle")}
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="my-10 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-teal-500/10 text-teal-300 text-xs font-semibold mb-4 border border-teal-500/20">
          <Activity className="w-3.5 h-3.5 text-teal-400" /> {t("common.platformTitle")}
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-100 tracking-tight leading-tight">
          {t("auth.signInSubtitle")}
        </h1>
        <p className="mt-4 text-base md:text-lg text-slate-400">
          {t("student.subtitle")}
        </p>
      </div>

      {/* 3 Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {/* Student Portal Card */}
        <div className="p-6 bg-[#131D33] rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">{t("common.studentPortal")}</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {t("student.subtitle")}
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <Link
              href={getPortalHref("student")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors w-full justify-center shadow-sm"
            >
              {currentUser?.role === "student" ? t("common.studentPortal") : `${t("common.signIn")} (${t("auth.student")})`}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {!currentUser && (
              <Link
                href="/register?role=student"
                className="block text-center text-[11px] font-medium text-slate-400 hover:text-teal-300 transition-colors"
              >
                {t("auth.noAccount")} {t("auth.createOne")} &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Examiner Portal Card */}
        <div className="p-6 bg-[#131D33] rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center mb-4">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">{t("common.examinerPortal")}</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {t("examiner.subtitle")}
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <Link
              href={getPortalHref("examiner")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors w-full justify-center shadow-sm"
            >
              {currentUser && (currentUser.role === "examiner" || currentUser.role === "admin")
                ? t("common.examinerPortal")
                : `${t("common.signIn")} (${t("auth.examiner")})`}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {!currentUser && (
              <Link
                href="/register?role=examiner"
                className="block text-center text-[11px] font-medium text-slate-400 hover:text-teal-300 transition-colors"
              >
                {t("auth.noAccount")} {t("auth.createOne")} &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Administrator Card */}
        <div className="p-6 bg-[#131D33] rounded-2xl border border-slate-800 shadow-lg hover:border-slate-700 transition-all flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">{t("common.adminPortal")}</h2>
            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              {t("admin.subtitle")}
            </p>
          </div>
          <div className="mt-6">
            <Link
              href={getPortalHref("admin")}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 transition-colors w-full justify-center shadow-sm"
            >
              {currentUser?.role === "admin" ? t("common.adminPortal") : `${t("common.signIn")} (${t("auth.admin")})`}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-slate-500">
        {t("common.appName")} &bull; {t("common.platformTitle")} &copy; 2026.
      </footer>
    </main>
  );
}
