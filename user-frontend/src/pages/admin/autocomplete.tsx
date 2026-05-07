import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface ACOption {
  id: string | number;
  label: string;        // tên hiển thị
  sub?: string;         // dòng phụ (quốc tịch, năm sinh...)
  avatar?: string;      // url ảnh
}

interface Props {
  placeholder?: string;
  searchUrl: (keyword: string) => string;   // fn tạo URL search
  mapResult: (item: any) => ACOption;       // map API item → ACOption
  selected: ACOption[];
  onChange: (items: ACOption[]) => void;
  multiple?: boolean;
  label?: string;
}

function highlight(text: string, keyword: string) {
  if (!keyword.trim()) return <span>{text}</span>;
  const idx = text.toLowerCase().indexOf(keyword.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className="bg-yellow-400/80 text-black rounded-[2px] px-[1px]">{text.slice(idx, idx + keyword.length)}</mark>
      {text.slice(idx + keyword.length)}
    </span>
  );
}

export function AutocompleteInput({ placeholder, searchUrl, mapResult, selected, onChange, multiple = true, label }: Props) {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<ACOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(searchUrl(kw));
      if (res.ok) {
        const data = await res.json();
        setResults(data.map(mapResult));
        setOpen(true);
      }
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [searchUrl, mapResult]);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(keyword), 300);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [keyword, doSearch]);

  // Click outside → close
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const select = (opt: ACOption) => {
    const alreadyIn = selected.some(s => s.id === opt.id);
    if (!alreadyIn) {
      onChange(multiple ? [...selected, opt] : [opt]);
    }
    setKeyword('');
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  const remove = (id: string | number) => onChange(selected.filter(s => s.id !== id));

  return (
    <div ref={containerRef} className="relative">
      {label && <label className="block text-[9px] font-black text-neutral-500 uppercase tracking-[0.25em] mb-1">{label}</label>}

      {/* Chip container + input */}
      <div
        className="min-h-[44px] w-full bg-black border border-neutral-800 rounded-sm px-3 py-2 flex flex-wrap gap-2 items-center cursor-text focus-within:border-white transition-all"
        onClick={() => inputRef.current?.focus()}
      >
        {selected.map(opt => (
          <span key={opt.id} className="flex items-center gap-1 bg-neutral-800 text-white text-[11px] font-semibold px-2 py-1 rounded-sm">
            {opt.avatar && (
              <img src={opt.avatar} alt="" className="w-4 h-4 rounded-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
            )}
            {opt.label}
            <button type="button" onClick={e => { e.stopPropagation(); remove(opt.id); }} className="ml-1 text-neutral-400 hover:text-red-400 transition-colors leading-none">×</button>
          </span>
        ))}
        <input
          ref={inputRef}
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          placeholder={selected.length === 0 ? (placeholder ?? 'Gõ để tìm kiếm...') : ''}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-white outline-none placeholder:text-neutral-600"
        />
        {loading && <span className="material-symbols-outlined text-[16px] text-neutral-600 animate-spin">progress_activity</span>}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-700 rounded-sm shadow-2xl overflow-hidden max-h-[280px] overflow-y-auto hide-scrollbar">
          {results.map(opt => {
            const isSelected = selected.some(s => s.id === opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => select(opt)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${isSelected ? 'bg-neutral-700 opacity-50 cursor-not-allowed' : 'hover:bg-neutral-800'}`}
                disabled={isSelected}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-neutral-700 flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {opt.avatar
                    ? <img src={opt.avatar} alt="" className="w-full h-full object-cover" onError={e => (e.currentTarget.style.display = 'none')} />
                    : <span className="material-symbols-outlined text-[14px] text-neutral-500">person</span>
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-white truncate">{highlight(opt.label, keyword)}</div>
                  {opt.sub && <div className="text-[11px] text-neutral-500 truncate">{opt.sub}</div>}
                </div>
                {isSelected && <span className="material-symbols-outlined text-[14px] text-green-500">check_circle</span>}
              </button>
            );
          })}
        </div>
      )}

      {open && results.length === 0 && keyword && !loading && (
        <div className="absolute z-50 top-full mt-1 left-0 right-0 bg-neutral-900 border border-neutral-700 rounded-sm shadow-2xl px-4 py-6 text-center text-[11px] text-neutral-600 uppercase tracking-widest">
          Không tìm thấy kết quả
        </div>
      )}
    </div>
  );
}


export default function DummyNextPage() { return null; }
