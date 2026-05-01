import React from 'react';
import BaseTable from '../BaseTable';
import MovieGenreForm from './MovieGenreForm';

export default function MovieGenresTable(props: any) {
  return <BaseTable 
    tableName="MovieGenres" 
    title="Movie-Genre Relations" 
    FormComponent={MovieGenreForm} 
    {...props} 
  />;
}
