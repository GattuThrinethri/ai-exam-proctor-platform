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

export default function AdminOverviewPage() {
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
        <div className="w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        Aggregating platform metrics and security indicators...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Platform Governance & Health</h1>
          <p className="text-sm text-slate-500 mt-1">
            System-wide oversight across candidate participation, proctoring security, and institution accounts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> Systems Operational
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* KPI Cards Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Total Users */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Users</p>
              <p className="text-2xl font-extrabold text-slate-900">{stats.total_users}</p>
              <p className="text-[11px] text-slate-500">
                {stats.total_students} Students &bull; {stats.total_examiners} Examiners
              </p>
            </div>
          </div>

          {/* Active Exams */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exams Configured</p>
              <p className="text-2xl font-extrabold text-slate-900">{stats.total_exams}</p>
              <p className="text-[11px] text-indigo-600 font-medium">{stats.active_exams} Open Right Now</p>
            </div>
          </div>

          {/* Completed Sessions */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Exam Sessions</p>
              <p className="text-2xl font-extrabold text-slate-900">{stats.total_sessions}</p>
              <p className="text-[11px] text-emerald-600 font-medium">{stats.completed_sessions} Evaluated</p>
            </div>
          </div>

          {/* Flagged Proctoring */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Flagged Sessions</p>
              <p className="text-2xl font-extrabold text-slate-900">{stats.flagged_sessions}</p>
              <p className="text-[11px] text-slate-500">Suspicion score &ge; 20</p>
            </div>
          </div>
        </div>
      )}

      {/* Governance Shortcuts & System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Governance Quick Card */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">User Account Management</h3>
              <p className="text-xs text-slate-500">Manage student and examiner permissions</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Provision new user accounts, update security roles with automated last-admin protection, and toggle active status.
          </p>
          <Link
            href="/admin/users"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Manage Platform Users &rarr;
          </Link>
        </div>

        {/* Global Exam Oversight */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Global Examination Oversight</h3>
              <p className="text-xs text-slate-500">All examinations across examiners</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Inspect all configured examination papers, candidate attendance metrics, proctoring settings, and administrative deletion controls.
          </p>
          <Link
            href="/admin/exams"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 hover:text-purple-800"
          >
            Inspect Global Exams &rarr;
          </Link>
        </div>

        {/* Security Audit Trail */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">System Security Audit Logs</h3>
              <p className="text-xs text-slate-500">Trace immutable administrative changes</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Chronological audit logs of role updates, account state toggles, result publications, and security incidents.
          </p>
          <Link
            href="/admin/audit"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800"
          >
            Review Audit Trail &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
