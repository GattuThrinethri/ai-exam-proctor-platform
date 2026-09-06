"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ShieldAlert,
  Users,
  FileSpreadsheet,
  History,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Menu,
  X,
  UserCheck
} from "lucide-react";
import { authService, AuthUser } from "../../services/auth";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: "Overview", href: "/admin", icon: LayoutDashboard },
  { label: "User Management", href: "/admin/users", icon: Users },
  { label: "Pending Examiners", href: "/admin/pending-examiners", icon: UserCheck },
  { label: "Exam Oversight", href: "/admin/exams", icon: FileSpreadsheet },
  { label: "Audit Logs", href: "/admin/audit", icon: History },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const currentUser = authService.getUser();
    const token = authService.getToken();

    if (!token || !currentUser) {
      router.replace(`/login?role=admin&redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    setUser(currentUser);
    setCheckingAuth(false);
  }, [router, pathname]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-300">Verifying administrator security clearance...</p>
        </div>
      </div>
    );
  }

  // Role Protection: Non-admins cannot access admin portal
  if (user && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 p-8 rounded-2xl border border-red-800 shadow-xl text-center text-white">
          <div className="w-12 h-12 bg-red-900/50 text-red-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-700">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">Access Denied (403)</h2>
          <p className="text-sm text-slate-300 mb-6">
            Administrator privileges required. Your account ({user.email}) does not have administrative security clearance.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push(user.role === "examiner" ? "/examiner" : "/student")}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Go to {user.role === "examiner" ? "Examiner" : "Student"} Portal
            </button>
            <button
              onClick={() => authService.logout()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Admin Top Navbar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Platform Name */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-md shadow-red-900/30">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <span className="text-lg font-bold text-white tracking-tight">IntelliExam</span>
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-red-900/50 text-red-300 border border-red-700">
                  Admin Portal
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-slate-800 text-white shadow-inner"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${isActive ? "text-red-400" : "text-slate-500"}`} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User Profile & Logout */}
            <div className="hidden md:flex items-center gap-4">
              <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
                <div className="w-8 h-8 rounded-full bg-red-900/40 text-red-300 flex items-center justify-center font-semibold text-xs border border-red-700">
                  A
                </div>
                <div className="text-left text-xs">
                  <p className="font-semibold text-slate-200 leading-tight">{user?.name}</p>
                  <p className="text-slate-400 leading-tight">{user?.email}</p>
                </div>
              </div>

              <button
                onClick={() => authService.logout()}
                className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
                title="Logout"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-800"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-800 bg-slate-900 px-4 pt-2 pb-4 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                    isActive ? "bg-slate-800 text-white" : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                  }`}
                >
                  <Icon className="w-5 h-5 text-slate-400" />
                  {item.label}
                </Link>
              );
            })}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-300">
                <p className="font-semibold">{user?.name}</p>
                <p className="text-slate-500">{user?.email}</p>
              </div>
              <button
                onClick={() => authService.logout()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 bg-red-950/40 rounded-lg hover:bg-red-900/50"
              >
                <LogOut className="w-3.5 h-3.5" /> Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        Administrator Control & Governance &bull; IntelliExam Platform Security
      </footer>
    </div>
  );
}
