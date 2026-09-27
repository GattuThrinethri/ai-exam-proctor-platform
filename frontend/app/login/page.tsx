"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  LogIn,
  AlertCircle,
  GraduationCap,
  UserCheck,
  Shield,
  ArrowLeft,
} from "lucide-react";
import { authService } from "../../services/auth";
import LanguageSelector from "../../components/layout/LanguageSelector";
import { useLanguage } from "../../i18n";

type PortalRole = "student" | "examiner" | "admin";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const roleParam = searchParams.get("role") as PortalRole | null;
  const redirectParam = searchParams.get("redirect");
  const expiredParam = searchParams.get("expired");
  const registeredParam = searchParams.get("registered");

  const [selectedRole, setSelectedRole] = useState<PortalRole>(
    roleParam === "examiner" || roleParam === "admin" ? roleParam : "student"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(
    registeredParam
      ? t("auth.accountCreatedSuccess")
      : expiredParam
      ? t("auth.sessionExpired")
      : null
  );

  // If user is already authenticated, redirect immediately
  useEffect(() => {
    if (authService.isAuthenticated()) {
      const user = authService.getUser();
      if (user) {
        if (user.role === "admin") router.replace("/admin");
        else if (user.role === "examiner") router.replace("/examiner");
        else router.replace("/student");
      }
    }
  }, [router]);

  // Update selected role if query param changes
  useEffect(() => {
    if (roleParam && (roleParam === "student" || roleParam === "examiner" || roleParam === "admin")) {
      setSelectedRole(roleParam);
    }
  }, [roleParam]);

  // Quick helper to populate demo credentials
  const fillCredentials = (role: PortalRole) => {
    setSelectedRole(role);
    setError(null);
    if (role === "student") {
      setEmail("student@example.com");
      setPassword("Student@123");
    } else if (role === "examiner") {
      setEmail("examiner@example.com");
      setPassword("Examiner@123");
    } else if (role === "admin") {
      setEmail("admin@example.com");
      setPassword("Admin@123");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const data = await authService.login(email.trim(), password);
      const userRole = data.user.role;

      // Authoritative routing based on authenticated user's role
      let destination = "/";
      if (userRole === "admin") {
        destination = "/admin";
      } else if (userRole === "examiner") {
        destination = "/examiner";
      } else {
        destination = "/student";
      }

      // Check if intended redirect is permitted for this role
      if (redirectParam && redirectParam.startsWith("/")) {
        if (userRole === "admin") {
          destination = redirectParam;
        } else if (userRole === "examiner" && redirectParam.startsWith("/examiner")) {
          destination = redirectParam;
        } else if (userRole === "student" && redirectParam.startsWith("/student")) {
          destination = redirectParam;
        }
      }

      router.push(destination);
    } catch (err: any) {
      setError(err.message || t("auth.invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = () => {
    if (selectedRole === "admin") {
      return {
        label: t("common.adminPortal"),
        color: "bg-purple-100 text-purple-800 border-purple-300",
        icon: Shield,
      };
    }
    if (selectedRole === "examiner") {
      return {
        label: t("common.examinerPortal"),
        color: "bg-indigo-100 text-indigo-800 border-indigo-300",
        icon: UserCheck,
      };
    }
    return {
      label: t("common.studentPortal"),
      color: "bg-sky-100 text-sky-800 border-sky-300",
      icon: GraduationCap,
    };
  };

  const badge = getRoleBadge();
  const BadgeIcon = badge.icon;

  return (
    <>
      {/* Selected Role Indicator Badge */}
      <div className="mb-4 flex justify-center">
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badge.color}`}
        >
          <BadgeIcon className="w-3.5 h-3.5" />
          {badge.label}
        </span>
      </div>

      <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-slate-200 sm:px-10">
        {/* Role selector tabs */}
        <div className="mb-6 grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => setSelectedRole("student")}
            className={`py-1.5 rounded-lg transition-all ${
              selectedRole === "student"
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("auth.student")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("examiner")}
            className={`py-1.5 rounded-lg transition-all ${
              selectedRole === "examiner"
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("auth.examiner")}
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole("admin")}
            className={`py-1.5 rounded-lg transition-all ${
              selectedRole === "admin"
                ? "bg-white text-slate-900 shadow-sm font-semibold"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {t("auth.admin")}
          </button>
        </div>

        {/* Session Expired / Status Notice */}
        {notice && (
          <div className="mb-5 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2.5 text-amber-800 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
            <span>{notice}</span>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("auth.emailAddress")}
            </label>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                selectedRole === "admin"
                  ? "admin@example.com"
                  : selectedRole === "examiner"
                  ? "examiner@example.com"
                  : "student@example.com"
              }
              className="block w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {t("auth.password")}
            </label>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="block w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors mt-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t("auth.authenticating")}</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>
                  {t("auth.signInButton")} (
                  {selectedRole === "admin"
                    ? t("auth.admin")
                    : selectedRole === "examiner"
                    ? t("auth.examiner")
                    : t("auth.student")}
                  )
                </span>
              </>
            )}
          </button>
        </form>

        {/* Registration Link */}
        <div className="mt-4 text-center text-xs text-slate-600">
          {t("auth.noAccount")}{" "}
          <Link
            href={`/register?role=${selectedRole === "examiner" ? "examiner" : "student"}`}
            className="font-semibold text-indigo-600 hover:text-indigo-700 underline"
          >
            {t("auth.createOne")}
          </Link>
        </div>

        {/* Demo Quick Fill Section */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mb-2.5 text-center">
            {t("auth.demoCredentials")}
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => fillCredentials("student")}
              className={`py-2 px-1.5 border rounded-lg text-[11px] font-medium text-center transition-all ${
                selectedRole === "student" && email === "student@example.com"
                  ? "bg-sky-50 border-sky-300 text-sky-800 font-semibold"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t("auth.student")}
            </button>
            <button
              type="button"
              onClick={() => fillCredentials("examiner")}
              className={`py-2 px-1.5 border rounded-lg text-[11px] font-medium text-center transition-all ${
                selectedRole === "examiner" && email === "examiner@example.com"
                  ? "bg-indigo-50 border-indigo-300 text-indigo-800 font-semibold"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t("auth.examiner")}
            </button>
            <button
              type="button"
              onClick={() => fillCredentials("admin")}
              className={`py-2 px-1.5 border rounded-lg text-[11px] font-medium text-center transition-all ${
                selectedRole === "admin" && email === "admin@example.com"
                  ? "bg-purple-50 border-purple-300 text-purple-800 font-semibold"
                  : "border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              {t("auth.admin")}
            </button>
          </div>
          <div className="mt-3 text-[11px] text-slate-400 text-center">
            Student: <span className="font-mono text-slate-600">Student@123</span> &bull; Examiner: <span className="font-mono text-slate-600">Examiner@123</span> &bull; Admin: <span className="font-mono text-slate-600">Admin@123</span>
          </div>
        </div>
      </div>
    </>
  );
}

export default function LoginPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      {/* Top back button and language selector */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md mb-6 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.backToHome")}
        </Link>
        <LanguageSelector />
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="inline-flex items-center justify-center p-3.5 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-600/20 mb-4 text-white">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight">
          {t("auth.signInTitle")}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {t("auth.signInSubtitle")}
        </p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <Suspense
          fallback={
            <div className="bg-white py-12 px-6 shadow-sm rounded-2xl border border-slate-200 text-center">
              <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-500 font-medium">{t("common.loading")}</p>
            </div>
          }
        >
          <LoginFormInner />
        </Suspense>
      </div>
    </div>
  );
}
