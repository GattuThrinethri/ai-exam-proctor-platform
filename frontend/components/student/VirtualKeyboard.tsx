"use client";

import { useState } from "react";
import { Keyboard, X, Delete, Space } from "lucide-react";
import { LanguageCode } from "@/i18n/types";

interface VirtualKeyboardProps {
  language: LanguageCode;
  onInsertChar: (char: string) => void;
  onDeleteChar: () => void;
}

const KEYBOARD_LAYOUTS: Record<
  string,
  { vowels: string[]; consonants: string[]; signs: string[] }
> = {
  ta: {
    vowels: ["அ", "ஆ", "இ", "ஈ", "உ", "ஊ", "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ", "ஃ"],
    consonants: [
      "க", "ங", "ச", "ஞ", "ட", "ண", "த", "ந", "ப", "ம",
      "ய", "ர", "ல", "வ", "ழ", "ள", "ற", "ன", "ஷ", "ஸ", "ஹ"
    ],
    signs: ["ா", "ி", "ீ", "ு", "ூ", "ெ", "ே", "ை", "ொ", "ோ", "ௌ", "்"],
  },
  te: {
    vowels: ["అ", "ఆ", "ఇ", "ఈ", "ఉ", "ఊ", "ఋ", "ఎ", "ఏ", "ఐ", "ఒ", "ఓ", "ఔ", "అం", "అః"],
    consonants: [
      "క", "ఖ", "గ", "ఘ", "ఙ", "చ", "ఛ", "జ", "ఝ", "ఞ",
      "ట", "ఠ", "డ", "ఢ", "ణ", "త", "థ", "ద", "ధ", "న",
      "ప", "ఫ", "బ", "భ", "మ", "య", "ర", "ల", "వ", "శ", "ష", "స", "హ", "ళ"
    ],
    signs: ["ా", "ి", "ీ", "ు", "ూ", "ృ", "ె", "ే", "ై", "ొ", "ో", "ౌ", "ం", "ః", "్"],
  },
  hi: {
    vowels: ["अ", "आ", "इ", "ई", "उ", "ऊ", "ऋ", "ए", "ऐ", "ओ", "औ", "अं", "अः"],
    consonants: [
      "क", "ख", "ग", "घ", "ङ", "च", "छ", "ज", "झ", "ञ",
      "ट", "ठ", "ड", "ढ", "ण", "त", "थ", "द", "ध", "न",
      "प", "फ", "ब", "भ", "म", "य", "र", "ल", "व", "श", "ष", "स", "ह", "क्ष", "त्र", "ज्ञ"
    ],
    signs: ["ा", "ि", "ी", "ु", "ू", "ृ", "े", "ै", "ो", "ौ", "ं", "ः", "्"],
  },
  kn: {
    vowels: ["ಅ", "ಆ", "ಇ", "ಈ", "ಉ", "ಊ", "ಋ", "ಎ", "ಏ", "ಐ", "ಒ", "ಓ", "ಔ", "ಅಂ", "ಅಃ"],
    consonants: [
      "ಕ", "ಖ", "ಗ", "ಘ", "ಙ", "ಚ", "ಛ", "ಜ", "ಝ", "ಞ",
      "ಟ", "ಠ", "ಡ", "ಢ", "ಣ", "ತ", "ಥ", "ದ", "ಧ", "ನ",
      "ಪ", "ಫ", "ಬ", "ಭ", "ಮ", "ಯ", "ರ", "ಲ", "ವ", "ಶ", "ಷ", "ಸ", "ಹ", "ಳ"
    ],
    signs: ["ಾ", "ಿ", "ೀ", "ು", "ೂ", "ೃ", "ೆ", "ೇ", "ೈ", "ೊ", "ೋ", "ೌ", "ಂ", "ಃ", "್"],
  },
  ml: {
    vowels: ["അ", "ആ", "ഇ", "ഈ", "ഉ", "ഊ", "ഋ", "എ", "ഏ", "ഐ", "ഒ", "ഓ", "ഔ", "അം", "അഃ"],
    consonants: [
      "ക", "ഖ", "ഗ", "ഘ", "ങ", "ച", "ഛ", "ജ", "ഝ", "ഞ",
      "ട", "ഠ", "ഡ", "ഢ", "ണ", "ത", "ഥ", "ദ", "ധ", "ന",
      "പ", "ഫ", "ബ", "ഭ", "മ", "യ", "ര", "ല", "വ", "ശ", "ഷ", "സ", "ഹ", "ള", "ഴ", "റ"
    ],
    signs: ["ാ", "ി", "ീ", "ു", "ൂ", "ൃ", "െ", "േ", "ൈ", "ൊ", "ോ", "ൌ", "ം", "ഃ", "്"],
  },
};

export default function VirtualKeyboard({
  language,
  onInsertChar,
  onDeleteChar,
}: VirtualKeyboardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const layout = KEYBOARD_LAYOUTS[language];

  if (!layout) return null;

  return (
    <div className="mt-2 space-y-2">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#162238] border border-[#1e2d4a] text-teal-300 hover:bg-[#1a2744] hover:border-teal-500/50 transition-colors shadow-sm"
      >
        <Keyboard className="w-3.5 h-3.5 text-teal-400" />
        <span>{isOpen ? "Hide On-Screen Keyboard" : `On-Screen ${language.toUpperCase()} Keyboard`}</span>
      </button>

      {isOpen && (
        <div className="p-3.5 bg-[#131d33] border border-[#1e2d4a] rounded-2xl shadow-xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 border-b border-[#1e2d4a] text-xs font-bold text-slate-300">
            <span>Unicode On-Screen Input Helper ({language.toUpperCase()})</span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Signs / Matras */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-teal-400 uppercase tracking-wider block">
              Vowel Signs & Marks
            </span>
            <div className="flex flex-wrap gap-1">
              {layout.signs.map((char, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onInsertChar(char)}
                  className="w-8 h-8 rounded-lg bg-[#162238] hover:bg-[#1a2744] text-teal-200 border border-[#1e2d4a] hover:border-teal-500/50 text-sm font-semibold flex items-center justify-center transition-colors active:scale-95"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          {/* Vowels */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-purple-400 uppercase tracking-wider block">
              Vowels
            </span>
            <div className="flex flex-wrap gap-1">
              {layout.vowels.map((char, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onInsertChar(char)}
                  className="w-8 h-8 rounded-lg bg-[#162238] hover:bg-[#1a2744] text-purple-200 border border-[#1e2d4a] hover:border-purple-500/50 text-sm font-semibold flex items-center justify-center transition-colors active:scale-95"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          {/* Consonants */}
          <div className="space-y-1">
            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Consonants
            </span>
            <div className="flex flex-wrap gap-1">
              {layout.consonants.map((char, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onInsertChar(char)}
                  className="w-8 h-8 rounded-lg bg-[#162238] hover:bg-[#1a2744] text-slate-100 border border-[#1e2d4a] hover:border-slate-500/50 text-sm font-semibold flex items-center justify-center transition-colors active:scale-95"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>

          {/* Utility keys */}
          <div className="flex items-center gap-2 pt-2 border-t border-[#1e2d4a]">
            <button
              type="button"
              onClick={() => onInsertChar(" ")}
              className="flex-1 py-1.5 bg-[#162238] hover:bg-[#1a2744] text-slate-200 border border-[#1e2d4a] rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Space className="w-3.5 h-3.5" /> Space
            </button>
            <button
              type="button"
              onClick={onDeleteChar}
              className="px-4 py-1.5 bg-rose-950/50 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            >
              <Delete className="w-3.5 h-3.5" /> Backspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
