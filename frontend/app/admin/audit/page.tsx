"use client";

import { useEffect, useState } from "react";
import {
  History,
  Search,
  ShieldAlert,
  ShieldCheck,
  AlertCircle,
  Filter,
  User
} from "lucide-react";
import { adminApi, AdminAuditLog } from "@/services/api";
import { useLanguage } from "@/i18n";

export default function AdminAuditPage() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    loadLogs();
  }, [actionFilter]);

  async function loadLogs() {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAuditLogs({ action: actionFilter || undefined });
      setLogs(data);
    } catch (err: any) {
      setError(err.message || "Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  }

  function getActionBadge(action: string) {
    switch (action) {
      case "ROLE_CHANGE":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20">ROLE CHANGE</span>;
      case "STATUS_CHANGE":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">STATUS CHANGE</span>;
      case "USER_CREATED":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-teal-500/10 text-teal-300 border border-teal-500/20">USER CREATED</span>;
      case "EXAM_DELETED":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">EXAM DELETED</span>;
      case "RESULT_PUBLISHED":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">RESULT PUBLISHED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-800 text-slate-300">{action}</span>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("admin.auditLogs")}</h1>
        <p className="text-sm text-slate-400 mt-1">
          Chronological audit record of administrative operations, role promotions, and platform events.
        </p>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#131D33] p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300">Filter by Operation:</span>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
        >
          <option value="">All Operations</option>
          <option value="ROLE_CHANGE">Role Changes</option>
          <option value="STATUS_CHANGE">Status Changes</option>
          <option value="USER_CREATED">User Creations</option>
          <option value="EXAM_DELETED">Exam Deletions</option>
          <option value="RESULT_PUBLISHED">Result Publications</option>
        </select>
      </div>

      {/* Audit Log Stream */}
      <div className="bg-[#131D33] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">No audit logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0B132B] text-slate-300 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Operation</th>
                  <th className="px-6 py-3.5">Actor (Admin)</th>
                  <th className="px-6 py-3.5">Details / Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-slate-400 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">{getActionBadge(log.action)}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-200">{log.user_name || "System"}</p>
                      <p className="text-xs text-slate-400">{log.user_email}</p>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-300">
                      {log.details ? (
                        <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300 bg-[#0B132B] p-2 rounded border border-slate-800">
                          {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-slate-500 italic">No additional metadata</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
