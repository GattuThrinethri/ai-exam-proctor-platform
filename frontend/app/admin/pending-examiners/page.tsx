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
import { useLanguage } from "../../../i18n";

export default function PendingExaminersPage() {
  const { t } = useLanguage();
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
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-200 text-xs font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("admin.pendingExaminers")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            Review and clear new examiner account registrations.
          </p>
        </div>

        <button
          onClick={fetchPending}
          disabled={loading}
          className="p-2 text-slate-300 hover:text-white bg-[#131D33] border border-slate-800 rounded-xl hover:bg-slate-800 transition-colors shadow-sm self-start sm:self-auto"
          title={t("common.refresh")}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="bg-[#131D33] p-4 rounded-2xl border border-slate-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("common.search")}
            className="w-full pl-9 pr-4 py-1.5 bg-[#0B132B] border border-slate-700 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Pending List Grid */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
      ) : filteredExaminers.length === 0 ? (
        <div className="bg-[#131D33] p-12 rounded-2xl border border-slate-800 text-center text-slate-400 text-sm shadow-sm">
          <UserCheck className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="font-semibold text-slate-300">No Pending Examiner Clearances</p>
          <p className="text-xs text-slate-500 mt-1">
            All registered examiner requests have been reviewed or approved.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredExaminers.map((examiner) => (
            <div
              key={examiner.id}
              className="bg-[#131D33] rounded-2xl border border-slate-800 p-6 shadow-sm hover:border-slate-700 transition-all flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20 inline-flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {t("common.pending")}
                    </span>
                    <h3 className="text-lg font-bold text-slate-100 mt-2">{examiner.name}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3.5 h-3.5 text-slate-500" /> {examiner.email}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500 bg-[#0B132B] px-2 py-1 rounded border border-slate-800">
                    ID #{examiner.id}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Registered: {new Date(examiner.created_at).toLocaleDateString()}</span>
                  <span>Role: Examiner</span>
                </div>
              </div>

              <div className="pt-5 mt-4 border-t border-slate-800 flex items-center gap-3">
                <button
                  disabled={actionLoading === examiner.id}
                  onClick={() => setConfirmModal({ open: true, action: "approve", user: examiner })}
                  className="flex-1 py-2 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{t("admin.approve")}</span>
                </button>
                <button
                  disabled={actionLoading === examiner.id}
                  onClick={() => setConfirmModal({ open: true, action: "reject", user: examiner })}
                  className="flex-1 py-2 bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <XCircle className="w-4 h-4" />
                  <span>{t("admin.reject")}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] w-full max-w-sm rounded-2xl shadow-xl border border-slate-800 p-6 text-center space-y-4">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto ${
              confirmModal.action === "approve"
                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
            }`}>
              {confirmModal.action === "approve" ? (
                <UserCheck className="w-6 h-6" />
              ) : (
                <UserX className="w-6 h-6" />
              )}
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-100">
                {confirmModal.action === "approve" ? "Approve Examiner Account?" : "Reject Registration Request?"}
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {confirmModal.action === "approve"
                  ? `Grant examiner access to "${confirmModal.user.name}" (${confirmModal.user.email})?`
                  : `Reject account request for "${confirmModal.user.name}" (${confirmModal.user.email})?`}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-[#0B132B] border border-slate-700 text-slate-300 rounded-xl text-xs font-medium hover:bg-slate-800"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleAction}
                className={`px-4 py-2 text-xs font-semibold rounded-xl text-white ${
                  confirmModal.action === "approve"
                    ? "bg-emerald-600 hover:bg-emerald-500"
                    : "bg-rose-600 hover:bg-rose-500"
                }`}
              >
                {confirmModal.action === "approve" ? t("admin.approve") : t("admin.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
