import React from 'react';
import BaseTable from '../BaseTable';
import { AddMediaAssetForm } from './MediaAssetForm';

export default function MediaAssetsTable(props: any) {
  return <BaseTable 
    tableName="MediaAssets" 
    title="Media Assets" 
    FormComponent={AddMediaAssetForm} 
    {...props} 
  />;
}
