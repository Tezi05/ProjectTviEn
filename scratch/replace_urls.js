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
        
        // 1. Replace template literal `http://localhost:5113/api
        // with `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}
        content = content.replace(/`http:\/\/localhost:5113\/api/g, "`\\${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api'}");
        
        // 2. Replace single quote 'http://localhost:5113/api'
        // with (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api')
        // Note: we include the closing quote in the regex so we don't end up with invalid strings.
        content = content.replace(/'http:\/\/localhost:5113\/api'/g, "(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5113/api')");

        fs.writeFileSync(f, content);
        console.log('Processed', f);
    }
});
