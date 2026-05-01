import React from 'react';
import BaseTable from '../BaseTable';
import WatchlistForm from './WatchlistForm';

export default function WatchlistsTable(props: any) {
  return <BaseTable 
    tableName="Watchlists" 
    title="Watchlists" 
    FormComponent={WatchlistForm} 
    {...props} 
  />;
}
