import React from 'react';
import BaseTable from '../BaseTable';
import MovieCrewForm from './MovieCrewForm';

export default function MovieCrewsTable(props: any) {
  return <BaseTable 
    tableName="MovieCrews" 
    title="Movie-Crew Relations" 
    FormComponent={MovieCrewForm} 
    {...props} 
  />;
}
