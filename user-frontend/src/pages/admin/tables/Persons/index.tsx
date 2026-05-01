import React from 'react';
import BaseTable from '../BaseTable';
import PersonForm from './PersonForm';

export default function PersonsTable(props: any) {
  return <BaseTable 
    tableName="Persons" 
    title="People" 
    FormComponent={PersonForm} 
    {...props} 
  />;
}
