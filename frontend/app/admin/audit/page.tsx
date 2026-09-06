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

export default function AdminAuditPage() {
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
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">ROLE CHANGE</span>;
      case "STATUS_CHANGE":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">STATUS CHANGE</span>;
      case "USER_CREATED":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">USER CREATED</span>;
      case "EXAM_DELETED":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-red-50 text-red-700 border border-red-200">EXAM DELETED</span>;
      case "RESULT_PUBLISHED":
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">RESULT PUBLISHED</span>;
      default:
        return <span className="px-2.5 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">{action}</span>;
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Security & Governance Audit Logs</h1>
        <p className="text-sm text-slate-500 mt-1">
          Chronological, tamper-evident audit record of administrative operations, role promotions, and platform events.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-semibold text-slate-600">Filter by Operation:</span>
        </div>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500"
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
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">Loading security audit records...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No audit logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 text-xs uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Timestamp</th>
                  <th className="px-6 py-3.5">Operation</th>
                  <th className="px-6 py-3.5">Initiating Administrator</th>
                  <th className="px-6 py-3.5">Action Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 text-xs font-mono text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4">
                      {getActionBadge(log.action)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-xs">
                        <p className="font-semibold text-slate-800">{log.user_name}</p>
                        <p className="text-slate-400">{log.user_email || "System"}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-700 font-medium">
                      {log.details || "No additional metadata recorded."}
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
