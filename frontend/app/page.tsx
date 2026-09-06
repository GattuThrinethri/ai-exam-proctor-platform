"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, UserCheck, BookOpen, Activity, LogIn, LogOut, ArrowRight, ShieldAlert } from "lucide-react";
import { authService, AuthUser } from "../services/auth";

export default function Home() {
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
    <main className="flex min-h-screen flex-col items-center justify-between p-6 md:p-16 bg-slate-50">
      {/* Top Bar */}
      <div className="z-10 max-w-6xl w-full items-center justify-between flex flex-wrap gap-4 font-mono text-sm">
        <div className="flex items-center space-x-2 bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <span className="font-semibold text-slate-800">
            IntelliExam Secure Portal
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Health status */}
          <div className="hidden sm:flex items-center space-x-2">
            <span className="text-xs text-slate-500 font-medium">Backend & DB:</span>
            {loadingHealth ? (
              <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-600 rounded-full animate-pulse">
                Connecting...
              </span>
            ) : backendHealth?.status === "healthy" ? (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full flex items-center gap-1.5 border border-emerald-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Online (PostgreSQL: {backendHealth.database})
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
                Status: {backendHealth?.status || "Connecting..."}
              </span>
            )}
          </div>

          {/* Auth indicator */}
          {currentUser ? (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
              <div className="text-xs">
                <span className="font-semibold text-slate-800">{currentUser.name}</span>
                <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
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
                className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="p-1 text-slate-400 hover:text-red-600 rounded"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-sm transition-colors"
              >
                <LogIn className="w-3.5 h-3.5" />
                Sign In
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors"
              >
                Register
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Hero Section */}
      <div className="my-10 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-indigo-100 text-indigo-800 text-xs font-semibold mb-4 border border-indigo-200">
          <Activity className="w-3.5 h-3.5 text-indigo-600" /> Next-Gen AI Examination Platform
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
          AI-Based Examination & Automated Proctoring
        </h1>
        <p className="mt-4 text-base md:text-lg text-slate-600">
          Enterprise online assessments with client-side vision proctoring, server-authoritative timers, and automated candidate performance analysis.
        </p>
      </div>

      {/* 3 Portal Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
        {/* Student Portal Card */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-sky-100 text-sky-600 flex items-center justify-center mb-4">
              <BookOpen className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Student Portal</h2>
            <p className="mt-2 text-sm text-slate-600">
              Secure timed tests, randomized questions, progressive autosave, handwritten OCR upload, and verified test results.
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <Link
              href={getPortalHref("student")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors w-full justify-center shadow-sm"
            >
              {currentUser?.role === "student" ? "Open Student Portal" : "Login as Student"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {!currentUser && (
              <Link
                href="/register?role=student"
                className="block text-center text-[11px] font-medium text-slate-500 hover:text-sky-600 transition-colors"
              >
                New candidate? Create account &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Examiner Portal Card */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center mb-4">
              <UserCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Examiner Portal</h2>
            <p className="mt-2 text-sm text-slate-600">
              Question bank authoring, multi-type exams, AI subjective evaluation review, and proctoring audit.
            </p>
          </div>
          <div className="mt-6 space-y-2">
            <Link
              href={getPortalHref("examiner")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors w-full justify-center shadow-sm"
            >
              {currentUser && (currentUser.role === "examiner" || currentUser.role === "admin")
                ? "Open Examiner Portal"
                : "Login as Examiner"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            {!currentUser && (
              <Link
                href="/register?role=examiner"
                className="block text-center text-[11px] font-medium text-slate-500 hover:text-indigo-600 transition-colors"
              >
                New instructor? Create account &rarr;
              </Link>
            )}
          </div>
        </div>

        {/* Administrator Card */}
        <div className="p-6 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
          <div>
            <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-4">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-800">Administrator</h2>
            <p className="mt-2 text-sm text-slate-600">
              Platform governance, user management, security audit logging, and global exam session oversight.
            </p>
          </div>
          <div className="mt-6">
            <Link
              href={getPortalHref("admin")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-purple-600 rounded-lg hover:bg-purple-700 transition-colors w-full justify-center shadow-sm"
            >
              {currentUser?.role === "admin" ? "Open Admin Portal" : "Login as Administrator"}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-slate-400">
        AI-Based Intelligent Examination Platform &copy; 2026. All Systems Operational.
      </footer>
    </main>
  );
}
