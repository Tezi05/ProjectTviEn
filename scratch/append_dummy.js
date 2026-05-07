const fs = require('fs');

const files = [
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/autocomplete.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/components/GenericListView.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/forms.ts',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/tables/MediaAssets/MediaAssetForm.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/tables/Roles/RoleForm.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/config.ts',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/components/SharedUI.tsx'
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        
        // Check if there is already a default export to avoid duplicates
        if (!content.includes('export default')) {
            content += '\n\nexport default function DummyNextPage() { return null; }\n';
            fs.writeFileSync(f, content);
            console.log('Appended dummy default export to', f);
        } else {
            console.log('Already has default export:', f);
        }
    }
});
