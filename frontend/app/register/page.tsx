"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  UserPlus,
  AlertCircle,
  GraduationCap,
  UserCheck,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Mail,
  User
} from "lucide-react";
import { authService } from "../../services/auth";
import LanguageSelector from "../../components/layout/LanguageSelector";
import { useLanguage } from "../../i18n";

type RegisterRole = "student" | "examiner";

function RegisterFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const roleParam = searchParams.get("role") as RegisterRole | null;
  const initialRole: RegisterRole = roleParam === "examiner" ? "examiner" : "student";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<RegisterRole>(initialRole);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // If already authenticated, redirect to portal
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

  useEffect(() => {
    if (roleParam === "examiner" || roleParam === "student") {
      setRole(roleParam);
    }
  }, [roleParam]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    // Client-side validations
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!trimmedEmail || !emailRegex.test(trimmedEmail)) {
      setError(t("auth.invalidCredentials"));
      return;
    }

    if (role !== "student" && role !== "examiner") {
      setError("Please select a valid account type (Student or Examiner).");
      return;
    }

    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError(t("auth.passwordsDoNotMatch"));
      return;
    }

    setLoading(true);

    try {
      await authService.register(trimmedName, trimmedEmail, password, role);

      if (role === "examiner") {
        setSuccessMsg(t("auth.examinerApprovalNotice"));
      } else {
        setSuccessMsg(t("auth.regSuccessStudent"));
        try {
          await authService.login(trimmedEmail, password);
          router.push("/student");
        } catch {
          router.push(`/login?registered=1&role=student`);
        }
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("already exists")) {
        setError("An account with this email address already exists. Please sign in or use another email.");
      } else {
        setError(msg || "Registration failed. Please verify your information and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Account Type Selector Tabs */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-slate-300 mb-1.5 text-center sm:text-left">
          {t("auth.accountType")}
        </p>
        <div className="grid grid-cols-2 gap-2 bg-[#0B132B] p-1 rounded-xl text-xs font-medium border border-slate-800">
          <button
            type="button"
            onClick={() => {
              setRole("student");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
              role === "student"
                ? "bg-teal-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <GraduationCap className="w-4 h-4 text-slate-950" />
            <span>{t("auth.student")}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setRole("examiner");
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all ${
              role === "examiner"
                ? "bg-teal-500 text-slate-950 font-bold shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <UserCheck className="w-4 h-4 text-slate-950" />
            <span>{t("auth.examiner")}</span>
          </button>
        </div>

        {/* Examiner Approval Advisory Note */}
        {role === "examiner" && (
          <div className="mt-2.5 p-2.5 bg-amber-950/40 border border-amber-800/80 rounded-xl text-amber-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
            <span>{t("auth.examinerApprovalNotice")}</span>
          </div>
        )}
      </div>

      <div className="bg-[#131D33] py-8 px-6 shadow-xl rounded-2xl border border-slate-800 sm:px-10">
        {/* Success Alert */}
        {successMsg && (
          <div className="mb-5 p-3.5 rounded-xl bg-emerald-950/40 border border-emerald-800/80 flex flex-col gap-2 text-emerald-300 text-xs">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-emerald-400" />
              <span className="font-medium">{successMsg}</span>
            </div>
            {role === "examiner" && (
              <div className="mt-2 pt-2 border-t border-emerald-800/60">
                <Link
                  href="/login?role=examiner"
                  className="inline-flex items-center justify-center w-full py-2 px-3 text-xs font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 rounded-xl shadow-sm transition-colors"
                >
                  {t("common.signIn")}
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-start gap-2.5 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t("auth.fullName")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Doe"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-500 placeholder-slate-500 shadow-sm"
              />
            </div>
          </div>

          {/* Email Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t("auth.emailAddress")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={role === "examiner" ? "instructor@university.edu" : "student@university.edu"}
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-500 placeholder-slate-500 shadow-sm"
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t("auth.password")} <span className="text-slate-400 font-normal">(min. 6 characters)</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-500 placeholder-slate-500 shadow-sm"
              />
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              {t("auth.confirmPassword")}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-sm focus:outline-none focus:border-teal-500 placeholder-slate-500 shadow-sm"
              />
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 rounded-xl shadow-sm text-sm font-bold text-slate-950 bg-teal-500 hover:bg-teal-400 focus:outline-none disabled:opacity-50 transition-colors mt-4"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                <span>{t("auth.creatingAccount")}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>
                  {t("auth.registerButton")} ({role === "examiner" ? t("auth.examiner") : t("auth.student")})
                </span>
              </>
            )}
          </button>
        </form>

        {/* Navigation to Login */}
        <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-400">
          {t("auth.alreadyAccount")}{" "}
          <Link
            href={`/login?role=${role}`}
            className="font-semibold text-teal-400 hover:text-teal-300 underline"
          >
            {t("common.signIn")}
          </Link>
        </div>
      </div>
    </>
  );
}

export default function RegisterPage() {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#0B132B] text-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      {/* Top back button and language selector */}
      <div className="w-full max-w-md mx-auto mb-4 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-teal-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t("common.backToHome")}
        </Link>
        <LanguageSelector />
      </div>

      <div className="w-full max-w-md mx-auto text-center mb-4">
        <div className="inline-flex items-center justify-center p-3.5 bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-2xl shadow-lg mb-3">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
          {t("auth.registerTitle")}
        </h1>
        <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
          {t("auth.registerSubtitle")}
        </p>
      </div>

      <div className="w-full max-w-md mx-auto">
        <Suspense
          fallback={
            <div className="bg-[#131D33] py-12 px-6 shadow-sm rounded-2xl border border-slate-800 text-center">
              <div className="w-8 h-8 border-4 border-teal-400 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-xs text-slate-400 font-medium">{t("common.loading")}</p>
            </div>
          }
        >
          <RegisterFormInner />
        </Suspense>
      </div>
    </div>
  );
}
