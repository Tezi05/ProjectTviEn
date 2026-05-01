import React, { useState } from 'react';
import MoviesList from './MoviesList';
import MovieEditor from './MovieEditor';

export default function MoviesTable(props: any) {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [editingItem, setEditingItem] = useState<any>(null);

  if (view === 'editor') {
    return <MovieEditor 
      movie={editingItem} 
      onCancel={() => { setView('list'); setEditingItem(null); }} 
      onSaved={() => { setView('list'); setEditingItem(null); }} 
    />;
  }

  return (
    <MoviesList 
      {...props}
      onAdd={() => { setEditingItem(null); setView('editor'); }}
      onEdit={(item: any) => { setEditingItem(item); setView('editor'); }}
    />
  );
}
