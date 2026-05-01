import React from 'react';
import BaseTable from '../BaseTable';
import { RoleForm } from './RoleForm';

export default function RolesTable(props: any) {
  return <BaseTable 
    tableName="Roles" 
    title="Roles" 
    FormComponent={RoleForm} 
    {...props} 
  />;
}
