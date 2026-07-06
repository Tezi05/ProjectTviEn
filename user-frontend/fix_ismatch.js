const fs = require('fs');

let content = fs.readFileSync('e:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/index.tsx', 'utf8');

const oldIsMatch = `          const isMatch = (m: Movie, q: string) => {
            if (!q.trim()) return true;
            const segments = q.split(',').map(s => s.trim()).filter(Boolean);
            const actors: string[] = []; 
            const directors: string[] = []; 
            const years: string[] = []; 
            const genres: string[] = []; 
            const ages: string[] = []; 
            const types: string[] = []; 
            const titles: string[] = [];

            segments.forEach(seg => {
                const lower = seg.toLowerCase();
                if (lower.startsWith('diễn viên:')) actors.push(seg.substring('diễn viên:'.length).trim().toLowerCase());
                else if (lower.startsWith('đạo diễn:')) directors.push(seg.substring('đạo diễn:'.length).trim().toLowerCase());
                else if (lower.startsWith('năm:')) years.push(seg.substring('năm:'.length).trim().toLowerCase());
                else if (lower.startsWith('thể loại:')) genres.push(seg.substring('thể loại:'.length).trim().toLowerCase());
                else if (lower.startsWith('độ tuổi:')) ages.push(seg.substring('độ tuổi:'.length).trim().toLowerCase());
                else if (lower.startsWith('phân loại:')) types.push(seg.substring('phân loại:'.length).trim().toLowerCase());
                else titles.push(lower);
            });

            if (actors.length > 0 && !actors.every(a => m.crews?.some(c => c.roleId === 2 && c.fullName.toLowerCase().includes(a)))) return false;
            if (directors.length > 0 && !directors.every(d => m.crews?.some(c => c.roleId === 1 && c.fullName.toLowerCase().includes(d)))) return false;
            if (years.length > 0 && !years.every(y => m.releaseYear?.toString().includes(y))) return false;
            if (genres.length > 0 && !genres.every(g => 
              m.genres?.some(mg => mg.toLowerCase() === g) || 
              m.title.toLowerCase().includes(g) || 
              m.description?.toLowerCase().includes(g)
            )) return false;
            if (ages.length > 0 && !ages.every(a => m.ageRating?.toLowerCase().includes(a))) return false;
            if (types.length > 0 && !types.every(t => {
              if (t === 'blockbuster') return (m.weeklyViews || 0) > 5 || (m.weeklyViewsResetWeek || 0) > 0;
              if (t === 'indie') return (m.weeklyViews || 0) <= 5;
              return true;
            })) return false;
            if (titles.length > 0 && !titles.every(t => 
              m.title.toLowerCase().includes(t) || 
              m.description?.toLowerCase().includes(t) ||
              m.crews?.some(c => c.fullName.toLowerCase().includes(t)) ||
              m.releaseYear?.toString().includes(t)
            )) return false;
            return true;
          };`;

const newIsMatch = `          const isMatch = (m: Movie, q: string) => {
            if (!q.trim()) return true;
            const segments = q.split(',').map(s => s.trim()).filter(Boolean);
            const actors: string[] = []; 
            const directors: string[] = []; 
            const years: string[] = []; 
            const genres: string[] = []; 
            const ages: string[] = []; 
            const types: string[] = []; 
            const titles: string[] = [];

            segments.forEach(seg => {
                const lower = seg.toLowerCase();
                if (lower.startsWith('diễn viên:')) actors.push(seg.substring('diễn viên:'.length).trim().toLowerCase());
                else if (lower.startsWith('đạo diễn:')) directors.push(seg.substring('đạo diễn:'.length).trim().toLowerCase());
                else if (lower.startsWith('năm:')) years.push(seg.substring('năm:'.length).trim().toLowerCase());
                else if (lower.startsWith('thể loại:')) genres.push(seg.substring('thể loại:'.length).trim().toLowerCase());
                else if (lower.startsWith('độ tuổi:')) ages.push(seg.substring('độ tuổi:'.length).trim().toLowerCase());
                else if (lower.startsWith('phân loại:')) types.push(seg.substring('phân loại:'.length).trim().toLowerCase());
                else titles.push(lower);
            });

            if (actors.length > 0 && !actors.every(a => m.crews?.some(c => c.roleId === 2 && c.fullName.toLowerCase().includes(a)))) return false;
            if (directors.length > 0 && !directors.every(d => m.crews?.some(c => c.roleId === 1 && c.fullName.toLowerCase().includes(d)))) return false;
            
            // STRICT DB TAG MATCHING
            if (years.length > 0 && !years.every(y => m.releaseYear?.toString() === y)) return false;
            if (genres.length > 0 && !genres.every(g => m.genres?.some(mg => mg.toLowerCase() === g))) return false;
            if (ages.length > 0 && !ages.every(a => m.ageRating?.toLowerCase() === a)) return false;
            if (types.length > 0 && !types.every(t => {
              if (t === 'blockbuster') return m.isIndie === false;
              if (t === 'indie') return m.isIndie === true;
              return true;
            })) return false;
            
            if (titles.length > 0 && !titles.every(t => 
              m.title.toLowerCase().includes(t) || 
              (m.description || '').toLowerCase().includes(t)
            )) return false;
            return true;
          };`;

// Also fix the UI labels in Navbar for "phân loại" to send "blockbuster" and "indie" properly since we are checking them.
// Navbar already does: { label: 'Thương mại', query: 'blockbuster' }, { label: 'Độc lập', query: 'indie' }

if (content.includes("if (t === 'blockbuster') return (m.weeklyViews || 0) > 5 || (m.weeklyViewsResetWeek || 0) > 0;")) {
  content = content.replace(oldIsMatch, newIsMatch);
  fs.writeFileSync('e:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/index.tsx', content, 'utf8');
  console.log('Fixed isMatch to be strict with DB');
} else {
  console.log('Could not find oldIsMatch block');
}
