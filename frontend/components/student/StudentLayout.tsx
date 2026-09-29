"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Award,
} from "lucide-react";
import { authService, AuthUser } from "../../services/auth";
import AppHeader, { HeaderNavItem } from "../layout/AppHeader";
import { useLanguage } from "../../i18n";

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const currentUser = authService.getUser();
    const token = authService.getToken();

    if (!token || !currentUser) {
      router.replace(`/login?role=student&redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    if (currentUser.role !== "student") {
      if (currentUser.role === "examiner") {
        router.replace("/examiner");
        return;
      }
      if (currentUser.role === "admin") {
        router.replace("/admin");
        return;
      }
    }

    setUser(currentUser);
    setCheckingAuth(false);
  }, [router, pathname]);

  const navItems: HeaderNavItem[] = [
    { label: t("nav.dashboard"), href: "/student", icon: LayoutDashboard },
    { label: t("nav.availableExams"), href: "/student/exams", icon: FileSpreadsheet },
    { label: t("nav.myResults"), href: "/student/results", icon: Award },
  ];

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#0b132b] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-slate-400">
            {t("student.verifyingCredentials")}
          </p>
        </div>
      </div>
    );
  }

  // Active exam attempt interface takes the complete full window without the standard portal navbar/footer
  const isExamTakePage = pathname?.includes("/take");
  if (isExamTakePage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-[#0b132b] text-slate-100 flex flex-col">
      {/* Unified Top Header */}
      <AppHeader role="student" navItems={navItems} user={user} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#0f172a] border-t border-[#1e2d4a] py-4 text-center text-xs text-slate-400">
        {t("common.platformTitle")} &bull; {t("student.proctoring")}
      </footer>
    </div>
  );
}

