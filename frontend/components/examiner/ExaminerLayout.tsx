"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  BookOpen,
  FileSpreadsheet,
  Award,
  Eye,
  ShieldAlert,
} from "lucide-react";
import { authService, AuthUser } from "../../services/auth";
import AppHeader, { HeaderNavItem } from "../layout/AppHeader";
import { useLanguage } from "../../i18n";

export default function ExaminerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    // Check local storage auth
    const currentUser = authService.getUser();
    const token = authService.getToken();

    if (!token || !currentUser) {
      router.replace(`/login?role=examiner&redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    setUser(currentUser);
    setCheckingAuth(false);
  }, [router, pathname]);

  const navItems: HeaderNavItem[] = [
    { label: t("nav.dashboard"), href: "/examiner", icon: LayoutDashboard },
    { label: t("nav.questionBank"), href: "/examiner/questions", icon: BookOpen },
    { label: t("nav.exams"), href: "/examiner/exams", icon: FileSpreadsheet },
    { label: t("nav.examResults"), href: "/examiner/results", icon: Award },
    { label: t("nav.proctoringReview"), href: "/examiner/proctoring", icon: Eye },
  ];

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400 font-medium">
            {t("examiner.verifyingCredentials")}
          </p>
        </div>
      </div>
    );
  }

  // Role Protection: Students cannot view examiner portal
  if (user && user.role !== "examiner" && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-[#131d33] p-8 rounded-2xl border border-rose-800/60 shadow-xl text-center text-white">
          <div className="w-12 h-12 bg-rose-950/60 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-rose-700/50">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-slate-100 mb-2">{t("common.accessDenied")}</h2>
          <p className="text-sm text-slate-300 mb-6">
            {t("common.accessDeniedDesc")} ({user.email})
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => router.push("/student")}
              className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-slate-950 font-bold rounded-xl text-sm transition-colors"
            >
              {t("common.studentPortal")}
            </button>
            <button
              onClick={() => authService.logout()}
              className="px-4 py-2 bg-[#162238] hover:bg-[#1a2744] text-slate-200 border border-[#1e2d4a] rounded-xl text-sm font-medium transition-colors"
            >
              {t("common.signOut")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 flex flex-col">
      {/* Unified Top Header matching Student and Admin portals */}
      <AppHeader role="examiner" navItems={navItems} user={user} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#0f172a] border-t border-[#1e2d4a] py-4 text-center text-xs text-slate-400">
        {t("common.examinerPortal")} &bull; {t("common.platformTitle")}
      </footer>
    </div>
  );
}

