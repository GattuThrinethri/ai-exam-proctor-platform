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
          badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
          homeHref: "/admin",
          avatarBg: "bg-indigo-100 text-indigo-700 border-indigo-200",
          defaultInitial: "A",
        };
      case "examiner":
        return {
          icon: BookOpen,
          badgeText: t("common.examinerPortal"),
          badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
          homeHref: "/examiner",
          avatarBg: "bg-indigo-100 text-indigo-700 border-indigo-200",
          defaultInitial: "E",
        };
      case "student":
      default:
        return {
          icon: GraduationCap,
          badgeText: t("common.studentPortal"),
          badgeClass: "bg-indigo-50 text-indigo-700 border-indigo-200",
          homeHref: "/student",
          avatarBg: "bg-indigo-100 text-indigo-700 border-indigo-200",
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
    <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Badge */}
          <Link href={portal.homeHref} className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200 group-hover:bg-indigo-700 transition-colors">
              <PortalIcon className="w-6 h-6" />
            </div>
            <div>
              <span className="text-lg font-bold text-slate-900 tracking-tight">
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
          <nav className="hidden lg:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-indigo-50 text-indigo-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 ${
                      active ? "text-indigo-600" : "text-slate-400"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Controls: Language Selector, User Profile & Logout */}
          <div className="hidden md:flex items-center gap-3">
            {/* Multilingual Selector */}
            <LanguageSelector />

            {/* User Profile */}
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-200">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border ${portal.avatarBg}`}
              >
                {userInitial}
              </div>
              <div className="text-left text-xs max-w-[140px] truncate">
                <p className="font-semibold text-slate-800 leading-tight truncate">
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
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title={t("common.logout")}
              aria-label={t("common.logout")}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Mobile Right Controls: Language selector + hamburger */}
          <div className="flex items-center gap-2 md:hidden">
            <LanguageSelector compact />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-1 shadow-lg animate-in slide-in-from-top-2 duration-150">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isItemActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-indigo-50 text-indigo-700 font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    active ? "text-indigo-600" : "text-slate-400"
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs border ${portal.avatarBg}`}
              >
                {userInitial}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-800">{user?.name}</p>
                <p className="text-slate-400">{user?.email}</p>
              </div>
            </div>
            <button
              onClick={() => authService.logout()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-600 bg-red-50 rounded-lg hover:bg-red-100 font-medium transition-colors"
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
