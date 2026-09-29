"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Search,
  UserPlus,
  Shield,
  ShieldCheck,
  AlertCircle,
  CheckCircle,
  XCircle,
  X
} from "lucide-react";
import { adminApi, AdminUser } from "@/services/api";
import { useLanguage } from "@/i18n";

export default function AdminUsersPage() {
  const { t } = useLanguage();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");

  // Modal State for New User Provisioning
  const [showModal, setShowModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState("student");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [roleFilter, statusFilter, approvalFilter]);

  async function loadUsers() {
    setLoading(true);
    setError(null);
    try {
      const activeParam = statusFilter === "active" ? true : statusFilter === "inactive" ? false : undefined;
      const data = await adminApi.getUsers({
        role: roleFilter || undefined,
        is_active: activeParam,
        approval_status: approvalFilter || undefined,
        search: search || undefined,
      });
      setUsers(data);
    } catch (err: any) {
      setError(err.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: number, currentRole: string, newRoleVal: string) {
    if (currentRole === newRoleVal) return;
    try {
      await adminApi.updateUserRole(userId, newRoleVal);
      loadUsers();
    } catch (err: any) {
      alert(`Role change failed: ${err.message}`);
    }
  }

  async function handleStatusToggle(userId: number, currentStatus: boolean) {
    try {
      await adminApi.updateUserStatus(userId, !currentStatus);
      loadUsers();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await adminApi.createUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      setShowModal(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      setNewRole("student");
      loadUsers();
    } catch (err: any) {
      alert(`User creation failed: ${err.message}`);
    } finally {
      setCreating(false);
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">{t("admin.userList")}</h1>
          <p className="text-sm text-slate-400 mt-1">
            {t("admin.userAccountManagement")}
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-semibold text-sm hover:bg-teal-400 transition-colors shadow-sm self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" /> {t("admin.provisionUser")}
        </button>
      </div>

      {error && (
        <div className="bg-rose-950/40 border border-rose-800/80 text-rose-300 px-4 py-3 rounded-xl flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-[#131D33] p-4 rounded-2xl border border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search")}
            className="w-full pl-10 pr-4 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-100 rounded-xl focus:outline-none focus:border-teal-500 placeholder-slate-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
          >
            <option value="">{t("admin.assignedRole")} (All)</option>
            <option value="student">{t("auth.student")}</option>
            <option value="examiner">{t("auth.examiner")}</option>
            <option value="admin">{t("auth.admin")}</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
          >
            <option value="">{t("admin.accountStatus")} (All)</option>
            <option value="active">{t("common.active")}</option>
            <option value="inactive">{t("common.inactive")}</option>
          </select>

          <select
            value={approvalFilter}
            onChange={(e) => setApprovalFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-[#0B132B] border border-slate-700 text-slate-200 rounded-xl focus:outline-none focus:border-teal-500"
          >
            <option value="">{t("admin.approvalStatus")} (All)</option>
            <option value="approved">{t("common.approved")}</option>
            <option value="pending">{t("common.pending")}</option>
            <option value="rejected">{t("common.rejected")}</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-[#131D33] rounded-2xl border border-slate-800 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-sm">{t("common.loading")}</div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No user accounts match your filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-[#0B132B] text-slate-300 text-xs uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">User Details</th>
                  <th className="px-6 py-3.5">{t("admin.assignedRole")}</th>
                  <th className="px-6 py-3.5">{t("admin.approvalStatus")}</th>
                  <th className="px-6 py-3.5">{t("admin.accountStatus")}</th>
                  <th className="px-6 py-3.5">Registered</th>
                  <th className="px-6 py-3.5 text-right">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-100">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, u.role, e.target.value)}
                        className="px-2.5 py-1 text-xs font-semibold bg-[#0B132B] border border-slate-700 text-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                      >
                        <option value="student">{t("auth.student")}</option>
                        <option value="examiner">{t("auth.examiner")}</option>
                        <option value="admin">{t("auth.admin")}</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        u.approval_status === "approved"
                          ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                          : u.approval_status === "pending"
                          ? "bg-amber-500/10 text-amber-300 border border-amber-500/20"
                          : "bg-rose-500/10 text-rose-300 border border-rose-500/20"
                      }`}>
                        {u.approval_status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-0.5 rounded text-xs font-semibold ${
                        u.is_active
                          ? "bg-teal-500/10 text-teal-300 border border-teal-500/20"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}>
                        {u.is_active ? t("common.active") : t("common.inactive")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleStatusToggle(u.id, u.is_active)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          u.is_active
                            ? "bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20"
                            : "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/20"
                        }`}
                      >
                        {u.is_active ? t("admin.deactivate") : t("admin.activate")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Provision User Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="bg-[#131D33] w-full max-w-md rounded-2xl shadow-xl border border-slate-800 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#0B132B]">
              <h2 className="text-base font-bold text-slate-100">{t("admin.provisionUser")}</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded-lg text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t("auth.fullName")}</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t("auth.emailAddress")}</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t("auth.password")}</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">{t("admin.assignedRole")}</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0B132B] border border-slate-700 rounded-xl text-slate-100 text-xs focus:border-teal-500 focus:outline-none"
                >
                  <option value="student">{t("auth.student")}</option>
                  <option value="examiner">{t("auth.examiner")}</option>
                  <option value="admin">{t("auth.admin")}</option>
                </select>
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-300 bg-[#0B132B] border border-slate-700 rounded-xl hover:bg-slate-800"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 text-xs font-semibold text-slate-950 bg-teal-500 rounded-xl hover:bg-teal-400 disabled:opacity-50"
                >
                  {creating ? t("common.loading") : t("admin.provisionUser")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
