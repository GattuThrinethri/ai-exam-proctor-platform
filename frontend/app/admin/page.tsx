"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users,
  GraduationCap,
  BookOpen,
  FileSpreadsheet,
  AlertCircle,
  ShieldAlert,
  Activity,
  Award,
  ArrowRight,
  ShieldCheck,
  Server
} from "lucide-react";
import { adminApi, AdminPlatformStats } from "@/services/api";
import { useLanguage } from "@/i18n";

export default function AdminOverviewPage() {
  const { t } = useLanguage();
  const [stats, setStats] = useState<AdminPlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getStats();
      setStats(data);
    } catch (err: any) {
      setError(err.message || "Failed to load platform statistics");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center text-slate-400 text-sm">
        <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        {t("common.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("admin.overview")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("admin.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Operational
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* KPI Cards Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Users */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("admin.totalUsers")}</p>
              <p className="text-2xl font-extrabold text-slate-100">{stats.total_users}</p>
              <p className="text-[11px] text-slate-400">
                {stats.total_students} Students &bull; {stats.total_examiners} Examiners
              </p>
            </div>
          </div>

          {/* Active Exams */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("admin.activeExams")}</p>
              <p className="text-2xl font-extrabold text-slate-100">{stats.total_exams}</p>
              <p className="text-[11px] text-teal-400 font-semibold">{stats.active_exams} Open Now</p>
            </div>
          </div>

          {/* Pending Approvals */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-300 border border-amber-500/20 flex items-center justify-center font-bold">
              <GraduationCap className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("admin.pendingApprovals")}</p>
              <p className="text-2xl font-extrabold text-slate-100">{stats.pending_examiner_approvals ?? 0}</p>
              <Link href="/admin/pending-examiners" className="text-[11px] text-amber-300 font-medium hover:underline">
                Review Clearance →
              </Link>
            </div>
          </div>

          {/* Question Bank */}
          <div className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center justify-center font-bold">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{t("examiner.questionBank")}</p>
              <p className="text-2xl font-extrabold text-slate-100">{stats.total_questions ?? stats.total_sessions}</p>
              <p className="text-[11px] text-slate-400">Total Available Item Pool</p>
            </div>
          </div>
        </div>
      )}

      {/* Control Actions Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Link
          href="/admin/users"
          className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition-all space-y-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center border border-teal-500/20">
            <Users className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 group-hover:text-teal-400 transition-colors">{t("admin.userList")}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Provision roles, deactivate accounts, and audit user permissions.
          </p>
        </Link>

        <Link
          href="/admin/pending-examiners"
          className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition-all space-y-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-300 flex items-center justify-center border border-amber-500/20">
            <GraduationCap className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 group-hover:text-amber-300 transition-colors">{t("admin.pendingExaminers")}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Approve or decline registered examiner accounts before dashboard access is cleared.
          </p>
        </Link>

        <Link
          href="/admin/audit"
          className="bg-[#131D33] p-6 rounded-2xl border border-slate-800 shadow-sm hover:border-slate-700 transition-all space-y-3 group"
        >
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-300 flex items-center justify-center border border-purple-500/20">
            <Server className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-slate-100 group-hover:text-purple-300 transition-colors">{t("admin.auditLogs")}</h3>
          <p className="text-xs text-slate-400 leading-relaxed">
            Inspect immutable security events, admin clearance actions, and authentication traces.
          </p>
        </Link>
      </div>
    </div>
  );
}
