import React from 'react';
import { API_BASE } from '../config';

export function GenericListView({ title, data, loading, error, trashView, onTabChange, onAdd, onEdit, onDelete, onRestore }: any) {
  if (loading) return <div className="py-20 text-center text-neutral-500 font-black uppercase tracking-[0.4em] animate-pulse">Loading {title}...</div>;
  if (error) return <div className="py-20 text-center text-red-500 font-black uppercase tracking-widest">{error}</div>;
  
  const columns = (data && data.length > 0) 
    ? Object.keys(data[0]).filter(k => !['deletedAt', 'passwordHash', 'normalizedEmail', 'normalizedUserName', 'concurrencyStamp', 'securityStamp'].includes(k.toLowerCase()))
    : [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
        <div className="flex flex-wrap items-center gap-6 lg:gap-12">
          <div>
            <h2 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">{title}</h2>
            <p className="text-[10px] text-neutral-500 font-black uppercase tracking-[0.2em] mt-2">
              {data && data.length > 0 ? `Found ${data.length} records` : `No records found`}
            </p>
          </div>
          
          {/* TAB SYSTEM - Image 1 Style */}
          <div className="flex bg-[#0A0A0A] border border-neutral-900 p-1 rounded-sm">
            <button 
              onClick={() => onTabChange(false)} 
              className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${!trashView ? 'bg-white text-black' : 'text-neutral-600 hover:text-white'}`}
            >
              Active
            </button>
            <button 
              onClick={() => onTabChange(true)} 
              className={`px-8 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all ${trashView ? 'bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)]' : 'text-neutral-600 hover:text-red-500'}`}
            >
              Trash
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          {onAdd && !trashView && (
            <button onClick={onAdd} className="h-12 px-10 bg-white text-black text-[10px] font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-105 active:scale-95 transition-all">
              Add New {title.replace(/s$/, '')}
            </button>
          )}
        </div>
      </div>

      {!data || data.length === 0 ? (
        <div className="py-24 border border-dashed border-neutral-800 rounded-sm bg-neutral-900/20 text-center space-y-4">
          <div className="text-[10px] text-neutral-600 font-black uppercase tracking-[0.4em]">No {trashView ? 'Deleted' : 'Active'} Data Found in {title}</div>
          {onAdd && !trashView && (
            <button onClick={onAdd} className="text-[9px] font-black uppercase tracking-widest text-white hover:underline">Click here to add your first record</button>
          )}
        </div>
      ) : (
        <div className="bg-[#141414] border border-[#2A2A2A] rounded-sm overflow-hidden shadow-2xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          <div className="overflow-x-auto hide-scrollbar">
            <table className="w-full text-left border-collapse min-w-[800px] sm:min-w-full">
              <thead className="bg-[#1A1A1A] border-b border-[#2A2A2A]">
                <tr>
                  {columns.map(col => <th key={col} className="px-4 lg:px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em]">{col}</th>)}
                  <th className="px-4 lg:px-6 py-4 text-[9px] font-black text-neutral-400 uppercase tracking-[0.3em] text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2A2A2A]">
                {data.map((item: any, idx: number) => (
                  <tr key={idx} className={`hover:bg-white/[0.02] transition-colors group ${trashView ? 'opacity-50' : ''}`}>
                    {columns.map(col => (
                      <td key={col} className="px-4 lg:px-6 py-4">
                        <span className="text-[12px] text-neutral-100 font-medium line-clamp-2 max-w-[200px] break-words" title={String(item[col] ?? '')}>
                          {(() => {
                            const val = item[col];
                            if (!val) return '-';
                            if (col.toLowerCase() !== 'path' && (col.toLowerCase().includes('date') || col.toLowerCase().includes('at'))) {
                              return new Date(val).toLocaleDateString();
                            }
                            const str = String(val);
                            // Rút gọn ID: Nếu cột có tên 'id' và dài hơn 8 ký tự
                            if (col.toLowerCase().includes('id') && str.length > 8) {
                              return `${str.substring(0, 5)}...`;
                            }
                            return str;
                          })()}
                        </span>
                      </td>
                    ))}
                    <td className="px-4 lg:px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3 lg:opacity-0 lg:group-hover:opacity-100 transition-all transform lg:translate-x-2 lg:group-hover:translate-x-0">
                        {trashView ? (
                          <button onClick={() => onRestore(item)} className="p-1.5 hover:bg-green-500/10 rounded text-neutral-500 hover:text-green-500 transition-all"><span className="material-symbols-outlined !text-[18px]">settings_backup_restore</span></button>
                        ) : (onEdit && <button onClick={() => onEdit(item)} className="p-1.5 hover:bg-white/10 rounded text-neutral-500 hover:text-white transition-all"><span className="material-symbols-outlined !text-[18px]">edit</span></button>)}
                        <button onClick={() => onDelete(item)} className="p-1.5 hover:bg-red-500/10 rounded text-neutral-500 hover:text-red-500 transition-all"><span className="material-symbols-outlined !text-[18px]">{trashView ? 'delete_forever' : 'delete'}</span></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
