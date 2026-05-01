import React from 'react';
import BaseTable from '../BaseTable';
import GenreForm from './GenreForm';

export default function GenresTable(props: any) {
  return <BaseTable 
    tableName="Genres" 
    title="Genres" 
    FormComponent={GenreForm} 
    {...props} 
  />;
}
