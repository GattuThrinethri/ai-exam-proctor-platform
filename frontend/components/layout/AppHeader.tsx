"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ShieldCheck,
  GraduationCap,
  BookOpen,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { authService, AuthUser } from "../../services/auth";
import LanguageSelector from "./LanguageSelector";
import { useLanguage } from "../../i18n";

export interface HeaderNavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

interface AppHeaderProps {
  role: "admin" | "examiner" | "student";
  navItems: HeaderNavItem[];
  user: AuthUser | null;
}

export default function AppHeader({ role, navItems, user }: AppHeaderProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { t } = useLanguage();

  const getPortalInfo = () => {
    switch (role) {
      case "admin":
        return {
          icon: ShieldCheck,
          badgeText: t("common.adminPortal"),
          badgeClass: "bg-purple-950/70 text-purple-300 border-purple-500/40",
          homeHref: "/admin",
          avatarBg: "bg-purple-900/60 text-purple-300 border-purple-700/50",
          defaultInitial: "A",
        };
      case "examiner":
        return {
          icon: BookOpen,
          badgeText: t("common.examinerPortal"),
          badgeClass: "bg-teal-950/70 text-teal-300 border-teal-500/40",
          homeHref: "/examiner",
          avatarBg: "bg-teal-900/60 text-teal-300 border-teal-700/50",
          defaultInitial: "E",
        };
      case "student":
      default:
        return {
          icon: GraduationCap,
          badgeText: t("common.studentPortal"),
          badgeClass: "bg-teal-950/70 text-teal-300 border-teal-500/40",
          homeHref: "/student",
          avatarBg: "bg-teal-900/60 text-teal-300 border-teal-700/50",
          defaultInitial: "S",
        };
    }
  };

  const portal = getPortalInfo();
  const PortalIcon = portal.icon;
  const userInitial = user?.name ? user.name[0].toUpperCase() : portal.defaultInitial;

  const isItemActive = (href: string) => {
    if (href === portal.homeHref) {
      return pathname === href;
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="bg-[#0b132b]/95 backdrop-blur-md border-b border-[#1e2d4a] sticky top-0 z-40 shadow-lg shadow-black/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Badge */}
          <Link href={portal.homeHref} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-md shadow-teal-500/20 group-hover:bg-teal-400 transition-colors">
              <PortalIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight">
                {t("common.appName")}
              </span>
              <span
                className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${portal.badgeClass}`}
              >
                {portal.badgeText}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    active
                      ? "bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30"
                      : "text-slate-300 hover:text-white hover:bg-[#162238]"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-teal-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Language Selector, User Profile & Logout (Desktop) */}
          <div className="hidden lg:flex items-center gap-3">
            {/* Multilingual Selector */}
            <LanguageSelector />

            {/* User Profile */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-[#1e2d4a]">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border ${portal.avatarBg}`}
              >
                {userInitial}
              </div>
              <div className="text-left text-xs max-w-[140px] truncate">
                <p className="font-semibold text-slate-200 leading-tight truncate">
                  {user?.name || "User"}
                </p>
                <p className="text-slate-400 leading-tight truncate">
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={() => authService.logout()}
              className="p-2 rounded-xl text-rose-400 hover:text-white hover:bg-rose-600/20 transition-colors"
              title={t("common.logout")}
              aria-label={t("common.logout")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Right Controls: Language selector + hamburger */}
          <div className="flex items-center gap-2 lg:hidden">
            <LanguageSelector compact />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-[#162238] focus:outline-none border border-[#1e2d4a]"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5 text-teal-400" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer / Sidebar */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1e2d4a] bg-[#0f172a] px-4 pt-3 pb-5 space-y-2 shadow-2xl animate-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-teal-500/20 text-teal-300 font-semibold border border-teal-500/40"
                      : "text-slate-300 hover:bg-[#162238] hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-teal-400" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-4 mt-2 border-t border-[#1e2d4a] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs border ${portal.avatarBg}`}
              >
                {userInitial}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-200">{user?.name}</p>
                <p className="text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                authService.logout();
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs text-rose-400 bg-rose-950/40 border border-rose-800/40 rounded-xl hover:bg-rose-600 hover:text-white font-medium transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{t("common.logout")}</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
}

