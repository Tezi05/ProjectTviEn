import React from 'react';
import BaseTable from '../BaseTable';
import ReviewForm from './ReviewForm';

export default function ReviewsTable(props: any) {
  return <BaseTable 
    tableName="Reviews" 
    title="Reviews" 
    FormComponent={ReviewForm} 
    {...props} 
  />;
}
