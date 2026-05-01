import React from 'react';
import BaseTable from '../BaseTable';
import UserForm from './UserForm';

export default function UsersTable(props: any) {
  return <BaseTable 
    tableName="Users" 
    title="Users" 
    FormComponent={UserForm} 
    {...props} 
  />;
}
