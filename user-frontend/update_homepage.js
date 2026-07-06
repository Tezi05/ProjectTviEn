const fs = require('fs');

let content = fs.readFileSync('e:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/index.tsx', 'utf8');

// 1. Add heroIndex state and newestMovies calculation
content = content.replace(
  /const featured = filteredMovies\.length > 0 \? filteredMovies\[0\] : \(movies\[0\] \|\| null\);/,
  `const newestMovies = React.useMemo(() => {
    return [...filteredMovies].sort((a, b) => parseInt(b.id) - parseInt(a.id)).slice(0, 5);
  }, [filteredMovies]);

  const [heroIndex, setHeroIndex] = useState(0);

  useEffect(() => {
    if (newestMovies.length === 0) return;
    const interval = setInterval(() => {
      setHeroIndex(prev => (prev + 1) % newestMovies.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [newestMovies]);

  const featured = newestMovies[heroIndex] || (movies[0] || null);`
);

// 2. Update the Hero header to have a transition on the image and text
// Wait, React handles image src changes instantly. To make it smooth, maybe we add key={featured?.id} to trigger animation.
content = content.replace(
  /<img src=\{featured\?\.posterUrl \|\| 'https:\/\/images\.unsplash\.com\/photo-1534447677768-be436bb09401\?q=80&w=2000'\} alt="" className="absolute inset-0 w-full h-full object-cover scale-105 z-0" \/>/,
  `<img key={featured?.id} src={featured?.posterUrl || 'https://images.unsplash.com/photo-1534447677768-be436bb09401?q=80&w=2000'} alt="" className="absolute inset-0 w-full h-full object-cover scale-105 z-0 animate-fade-in" />`
);

content = content.replace(
  /<h1 className="text-6xl md:text-8xl font-serif font-bold text-white mb-6 max-w-4xl tracking-tight leading-\[0\.9\]">/,
  `<h1 key={"title-"+featured?.id} className="text-6xl md:text-8xl font-serif font-bold text-white mb-6 max-w-4xl tracking-tight leading-[0.9] animate-fade-in">`
);

content = content.replace(
  /<p className="text-white\/60 text-lg max-w-2xl mb-10 font-light leading-relaxed">/,
  `<p key={"desc-"+featured?.id} className="text-white/60 text-lg max-w-2xl mb-10 font-light leading-relaxed animate-fade-in">`
);

// 3. Update main sections
const oldMainSections = `<section className="mb-24">
                <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">Phim Mới</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {loading ? [1,2,3,4,5].map(i => <div key={i} className="w-full aspect-[2/3] bg-white/5 animate-pulse rounded-sm" />) :
                    filteredMovies.map(m => <HoverPlayer key={m.id} {...m} onPlay={handlePlay} />)
                  }
                </div>
              </section>`;

const newMainSections = `<section className="mb-24">
                <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">Phim Mới</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {loading ? [1,2,3,4,5].map(i => <div key={i} className="w-full aspect-[2/3] bg-white/5 animate-pulse rounded-sm" />) :
                    newestMovies.map(m => <HoverPlayer key={m.id} {...m} onPlay={handlePlay} />)
                  }
                </div>
              </section>

              <section className="mb-24">
                <h2 className="text-[42px] font-serif font-bold text-white mb-12 tracking-tight">Tất Cả Phim</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                  {loading ? [1,2,3,4,5,6,7,8,9,10].map(i => <div key={i} className="w-full aspect-[2/3] bg-white/5 animate-pulse rounded-sm" />) :
                    filteredMovies.map(m => <HoverPlayer key={m.id} {...m} onPlay={handlePlay} />)
                  }
                </div>
              </section>`;

content = content.replace(oldMainSections, newMainSections);

fs.writeFileSync('e:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/index.tsx', content, 'utf8');
console.log('Homepage updated successfully');
