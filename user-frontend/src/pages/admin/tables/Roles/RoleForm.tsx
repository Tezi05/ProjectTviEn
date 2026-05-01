import React, { useState } from 'react';
import { API_BASE } from '../../config';
import { AddModal, Field, inp } from '../../components/SharedUI';

export function RoleForm({ onSaved, onClose }: { onSaved: () => void; onClose: () => void }) {
  const [f, setF] = useState({ name: '' });

  const submit = async () => {
    if (!f.name) return alert('Nhập Name');
    const res = await fetch(`${API_BASE}/admin/system/tables/Roles`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f)
    });
    if (res.ok) { onSaved(); onClose(); } else alert('Lỗi: ' + await res.text());
  };

  return (
    <AddModal title="Thêm Role" onClose={onClose} onSubmit={submit}>
      <Field label="Role Name *">
        <input className={inp} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="Admin / VIP / Member" />
      </Field>
    </AddModal>
  );
}
