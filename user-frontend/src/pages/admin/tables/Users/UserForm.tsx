import React, { useState } from 'react';
import { API_BASE } from '../../config';
import { AddModal, Field, inp, sel } from '../../components/SharedUI';

export default function UserForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState({ googleId: '', email: '', displayName: '', avatarUrl: '', roleId: '3' });

  const submit = async () => {
    if (!f.email || !f.displayName) return alert('Cần nhập Email và DisplayName');
    const res = await fetch(`${API_BASE}/admin/system/tables/Users`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, roleId: Number(f.roleId) })
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm User" onClose={onClose} onSubmit={submit}>
      <Field label="Email *"><input type="email" className={inp} value={f.email} onChange={e => setF({ ...f, email: e.target.value })} placeholder="user@gmail.com" /></Field>
      <Field label="Display Name *"><input className={inp} value={f.displayName} onChange={e => setF({ ...f, displayName: e.target.value })} placeholder="Nguyễn Văn A" /></Field>
      <Field label="Google ID"><input className={inp} value={f.googleId} onChange={e => setF({ ...f, googleId: e.target.value })} placeholder="google-sub-id" /></Field>
      <Field label="Avatar URL"><input className={inp} value={f.avatarUrl} onChange={e => setF({ ...f, avatarUrl: e.target.value })} placeholder="https://..." /></Field>
      <Field label="Role">
        <select className={sel} value={f.roleId} onChange={e => setF({ ...f, roleId: e.target.value })}>
          <option value="1">Admin</option><option value="2">VIP</option><option value="3">Member</option>
        </select>
      </Field>
    </AddModal>
  );
}
