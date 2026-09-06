"use client";

import { useState, useEffect } from "react";
import {
  UserCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  Calendar,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  UserX,
  Search
} from "lucide-react";
import { adminApi, AdminUser } from "../../../services/api";

export default function PendingExaminersPage() {
  const [examiners, setExaminers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    action: "approve" | "reject";
    user: AdminUser;
  } | null>(null);

  const fetchPending = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getPendingExaminers();
      setExaminers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load pending examiner requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleAction = async () => {
    if (!confirmModal) return;
    const { action, user } = confirmModal;
    setConfirmModal(null);
    setActionLoading(user.id);
    setError(null);

    try {
      if (action === "approve") {
        await adminApi.approveExaminer(user.id);
        setExaminers((prev) => prev.filter((e) => e.id !== user.id));
        setToast({
          message: `Examiner "${user.name}" (${user.email}) has been approved. They may now sign in.`,
          type: "success"
        });
      } else {
        await adminApi.rejectExaminer(user.id);
        setExaminers((prev) => prev.filter((e) => e.id !== user.id));
        setToast({
          message: `Examiner "${user.name}" registration request has been rejected.`,
          type: "error"
        });
      }
    } catch (err: any) {
      setError(err.message || `Failed to ${action} examiner.`);
    } finally {
      setActionLoading(null);
    }
  };

  const filteredExaminers = examiners.filter((e) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return e.name.toLowerCase().includes(term) || e.email.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-sm shadow-sm transition-all ${
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/30 text-rose-400"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-start justify-between gap-3 text-sm shadow-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError(null)}
            className="text-xs font-semibold underline hover:opacity-80"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Pending Examiner Requests
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              {examiners.length} Pending
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            Review instructor applications. Approved instructors gain access to question authoring and exam management.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchPending}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-800/80 p-3 sm:p-4 rounded-xl border border-slate-700 flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
          />
        </div>
        <div className="text-xs text-slate-400 self-end sm:self-auto">
          Showing {filteredExaminers.length} of {examiners.length} requests
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="py-16 text-center bg-slate-800/40 rounded-2xl border border-slate-800">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs text-slate-400">Loading pending requests...</p>
        </div>
      ) : filteredExaminers.length === 0 ? (
        <div className="py-16 text-center bg-slate-800/40 rounded-2xl border border-slate-800 p-6">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-200">No Pending Requests</h3>
          <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
            All examiner registration requests have been reviewed and processed.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredExaminers.map((examiner) => (
            <div
              key={examiner.id}
              className="bg-slate-800 rounded-xl border border-slate-700/80 p-5 shadow-sm hover:border-slate-600 transition-all flex flex-col justify-between"
            >
              <div>
                {/* Header: Name & Pending Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-white leading-tight">
                      {examiner.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-300 break-all">
                      <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span>{examiner.email}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 flex-shrink-0">
                    <Clock className="w-3 h-3" />
                    Pending
                  </span>
                </div>

                {/* Metadata */}
                <div className="text-xs text-slate-400 space-y-1.5 py-3 border-y border-slate-700/60 my-3">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      Registered
                    </span>
                    <span className="text-slate-300 font-medium">
                      {new Date(examiner.created_at).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric"
                      })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Target Role</span>
                    <span className="font-semibold text-indigo-400 uppercase text-[10px] px-1.5 py-0.5 bg-indigo-500/10 rounded border border-indigo-500/20">
                      Examiner
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button
                  type="button"
                  disabled={actionLoading === examiner.id}
                  onClick={() =>
                    setConfirmModal({
                      open: true,
                      action: "approve",
                      user: examiner
                    })
                  }
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Approve</span>
                </button>
                <button
                  type="button"
                  disabled={actionLoading === examiner.id}
                  onClick={() =>
                    setConfirmModal({
                      open: true,
                      action: "reject",
                      user: examiner
                    })
                  }
                  className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold bg-rose-600/90 hover:bg-rose-500 text-white shadow-sm transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>Reject</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-800 border border-slate-700 max-w-md w-full rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  confirmModal.action === "approve"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                }`}
              >
                {confirmModal.action === "approve" ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {confirmModal.action === "approve" ? "Approve Examiner" : "Reject Examiner"}
                </h3>
                <p className="text-xs text-slate-400">
                  Please confirm this administrative action.
                </p>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-300 mb-6 bg-slate-900/60 p-3 rounded-lg border border-slate-700/60">
              {confirmModal.action === "approve" ? (
                <>
                  Are you sure you want to approve{" "}
                  <strong className="text-white">{confirmModal.user.name}</strong> (
                  {confirmModal.user.email})? They will immediately be granted access to sign in as an Examiner.
                </>
              ) : (
                <>
                  Are you sure you want to reject the registration request for{" "}
                  <strong className="text-white">{confirmModal.user.name}</strong> (
                  {confirmModal.user.email})? Their account will be marked as rejected and sign in will remain blocked.
                </>
              )}
            </p>

            <div className="flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:bg-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                className={`px-4 py-2 rounded-lg text-xs font-semibold text-white shadow-sm transition-colors ${
                  confirmModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {confirmModal.action === "approve" ? "Confirm Approval" : "Confirm Rejection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
