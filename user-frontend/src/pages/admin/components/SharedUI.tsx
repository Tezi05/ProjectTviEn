import React, { useState } from 'react';

export const API_BASE = 'http://localhost:5113/api';
export const CDN_BASE = 'https://pub-843e9389e0234a5d89617300438edb37.r2.dev';

export const inp = "w-full bg-black border border-neutral-800 h-11 px-4 text-sm text-white focus:border-white outline-none transition-all rounded-sm";
export const sel = "w-full bg-black border border-neutral-800 h-11 px-4 text-sm text-white focus:border-white outline-none transition-all rounded-sm";
export const tex = "w-full bg-black border border-neutral-800 p-4 text-sm text-white focus:border-white outline-none transition-all rounded-sm min-h-[100px]";
export const lbl = "block text-[9px] font-black text-neutral-500 uppercase tracking-[0.25em] mb-1";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className={lbl}>{label}</label>{children}</div>;
}

export function AddModal({ title, onClose, onSubmit, children }: { title: string; onClose: () => void; onSubmit: () => Promise<void>; children: React.ReactNode }) {
  const [saving, setSaving] = useState(false);
  const handle = async () => { setSaving(true); try { await onSubmit(); } finally { setSaving(false); } };
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6" onClick={onClose}>
      <div className="bg-neutral-950 border border-neutral-800 rounded-sm w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto hide-scrollbar" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-neutral-800 sticky top-0 bg-neutral-950 z-10">
          <h2 className="text-sm font-black text-white uppercase tracking-widest">+ {title}</h2>
          <button onClick={onClose} className="text-neutral-500 hover:text-white material-symbols-outlined text-[20px]">close</button>
        </div>
        <div className="p-6 space-y-4">{children}</div>
        <div className="flex gap-3 p-6 border-t border-neutral-800">
          <button onClick={onClose} className="flex-1 h-10 border border-neutral-700 text-neutral-400 text-[10px] font-black uppercase tracking-widest hover:border-white hover:text-white transition-all rounded-sm">Cancel</button>
          <button onClick={handle} disabled={saving} className="flex-1 h-10 bg-white text-black text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all rounded-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export const toSlug = (text: string) => {
  let str = text.toLowerCase();
  str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  str = str.replace(/[đĐ]/g, 'd');
  str = str.replace(/([^0-9a-z-\s])/g, '');
  str = str.replace(/(\s+)/g, '-');
  str = str.replace(/-+/g, '-');
  str = str.replace(/^-+|-+$/g, '');
  return str;
};
