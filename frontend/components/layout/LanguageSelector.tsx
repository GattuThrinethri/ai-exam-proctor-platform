"use client";

import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Check } from "lucide-react";
import { useLanguage } from "../../i18n";
import { LanguageCode } from "../../i18n/types";

interface LanguageSelectorProps {
  compact?: boolean;
  className?: string;
}

export default function LanguageSelector({
  compact = false,
  className = "",
}: LanguageSelectorProps) {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const currentLang = languages.find((l) => l.code === language) || languages[0];

  const handleSelect = (code: LanguageCode) => {
    setLanguage(code);
    setIsOpen(false);
  };

  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
          isOpen
            ? "bg-[#162238] border-teal-500 text-teal-300 shadow-md shadow-teal-500/10"
            : "bg-[#131d33] border-[#1e2d4a] text-slate-200 hover:bg-[#162238] hover:border-teal-500/50 shadow-sm"
        }`}
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Choose Language"
      >
        <Globe className="w-3.5 h-3.5 text-teal-400 shrink-0" />
        <span>{currentLang.nativeName}</span>
        <span className="text-[10px] text-teal-400/80 uppercase font-bold">({currentLang.code})</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180 text-teal-400" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-[#131d33] shadow-2xl border border-[#1e2d4a] py-2 z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="px-3.5 py-1.5 text-[10px] font-extrabold text-teal-400/90 uppercase tracking-widest border-b border-[#1e2d4a]/80 flex items-center justify-between">
            <span>CHOOSE LANGUAGE</span>
            <Globe className="w-3 h-3 text-teal-400" />
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {languages.map((item) => {
              const isSelected = item.code === language;
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => handleSelect(item.code)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 text-xs transition-colors text-left ${
                    isSelected
                      ? "bg-teal-500/20 text-teal-300 font-bold border-l-2 border-teal-400"
                      : "text-slate-200 hover:bg-[#1a2744] hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{item.nativeName}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({item.name})</span>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-teal-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

