const fs = require('fs');

const files = [
    'E:/Study/CSharp2/ProjectTviEn/admin-frontend/src/app/page.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/components/SharedUI.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/tables/Genres/GenreForm.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/tables/Persons/PersonForm.tsx',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/admin/config.ts',
    'E:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/watch/[slug].tsx',
];

files.forEach(f => {
    if (fs.existsSync(f)) {
        let content = fs.readFileSync(f, 'utf8');
        
        // Remove the backslash before ${process.env.NEXT_PUBLIC_API_URL
        content = content.replace(/\\\$\{process\.env\.NEXT_PUBLIC_API_URL/g, "${process.env.NEXT_PUBLIC_API_URL");
        
        fs.writeFileSync(f, content);
        console.log('Fixed backslashes in', f);
    }
});
