const fs = require('fs');

let content = fs.readFileSync('e:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/index.tsx', 'utf8');

// 1. HoverPlayer modifications
content = content.replace(
  /const HoverPlayer = memo\(\(\{ id, slug, title, posterUrl, description \}: Movie\) => \{/,
  'const HoverPlayer = memo(({ id, slug, title, posterUrl, description, onPlay }: Movie & { onPlay?: (slug: string, id: string) => void }) => {'
);
content = content.replace(
  /onClick=\{\(\) => router\.push\(`\/watch\/\$\{slug \|\| id\}`\)\}/,
  'onClick={() => onPlay ? onPlay(slug || id, id) : router.push(`/watch/${slug || id}`)}'
);

// 2. Add handlePlay & resumePrompt state inside CinemaApp
content = content.replace(
  /const \[history, setHistory\] = useState<any\[\]>\(\[\]\);/,
  `const [history, setHistory] = useState<any[]>([]);
  const [resumePrompt, setResumePrompt] = useState<{slug: string, movieId: string, history: any} | null>(null);

  const handlePlay = (slug: string, movieId: string) => {
    const userHistory = history.find(h => h.movie && h.movie.id === movieId);
    if (userHistory && userHistory.progressSeconds > 5 && !userHistory.isCompleted) {
      setResumePrompt({ slug, movieId, history: userHistory });
    } else {
      router.push(\`/watch/\${slug}\`);
    }
  };`
);

// 3. Update HoverPlayer usages to pass onPlay={handlePlay}
content = content.replace(
  /<HoverPlayer id=\{w\.movie\.id\} slug=\{w\.movie\.slug\} title=\{w\.movie\.title\} posterUrl=\{w\.movie\.posterUrl\} description=\{w\.movie\.description\} \/>/g,
  '<HoverPlayer id={w.movie.id} slug={w.movie.slug} title={w.movie.title} posterUrl={w.movie.posterUrl} description={w.movie.description} onPlay={handlePlay} />'
);
content = content.replace(
  /<HoverPlayer key=\{m\.id\} \{\.\.\.m\} \/>/g,
  '<HoverPlayer key={m.id} {...m} onPlay={handlePlay} />'
);

// 4. Update isMatch parsing
content = content.replace(
  /else if \(\['g', 'pg', 'pg-13', 'r', 'nc-17'\]\.includes\(lower\)\) ages\.push\(lower\);\s+else if \(\['blockbuster', 'indie'\]\.includes\(lower\)\) types\.push\(lower\);/g,
  `else if (lower.startsWith('phân loại:')) types.push(seg.substring('phân loại:'.length).trim().toLowerCase());`
);

// 5. Remove Xem Tiếp section
const xemTiepRegex = /\{\s*history\.length > 0 && \(\s*<section className="mb-24">\s*<h2 className="text-\[42px\] font-serif font-bold text-white mb-12 tracking-tight">Xem Tiếp<\/h2>\s*<div className="flex gap-10 overflow-x-auto pb-10 hide-scrollbar">\s*\{\s*history\.map\(h => \(\s*<ContinueCard\s*key=\{h\.historyId\}\s*title=\{h\.movie\.title\}\s*progress=\{h\.isCompleted \? 100 : Math\.min\(100, \(h\.progressSeconds \/ 7200\) \* 100\)\}\s*imgUrl=\{h\.movie\.posterUrl\}\s*movieId=\{h\.movie\.id\}\s*slug=\{h\.movie\.slug\}\s*episode=\{h\.episode\}\s*\/>\s*\)\)\s*\}\s*<\/div>\s*<\/section>\s*\)\s*\}/;
content = content.replace(xemTiepRegex, '');

// 6. Add Resume Modal UI
const modalUI = `
        {resumePrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="relative bg-[#111] border border-white/10 p-8 w-full max-w-md rounded-sm shadow-2xl flex flex-col gap-6">
              <div>
                <h3 className="text-xl font-serif font-bold text-white mb-2">Xem tiếp?</h3>
                <p className="text-white/60 text-sm leading-relaxed">
                  Bạn đang xem dở <strong className="text-white">{resumePrompt.history.movie.title}</strong> 
                  {resumePrompt.history.episode ? \` (Tập \${resumePrompt.history.episode.episodeNumber})\` : ''} 
                  {' '}tại lúc <strong className="text-white">{Math.floor(resumePrompt.history.progressSeconds / 60)}:{Math.floor(resumePrompt.history.progressSeconds % 60).toString().padStart(2, '0')}</strong>.
                  Bạn có muốn tiếp tục không?
                </p>
              </div>
              <div className="flex justify-end gap-3 mt-4">
                <button 
                  onClick={() => { setResumePrompt(null); router.push(\`/watch/\${resumePrompt.slug}?restart=true\${resumePrompt.history.episode ? \`&episodeId=\${resumePrompt.history.episode.episodeId}\` : ''}\`); }}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-white/60 hover:text-white hover:bg-white/5 border border-transparent transition rounded-sm"
                >
                  Xem từ đầu
                </button>
                <button 
                  onClick={() => { setResumePrompt(null); router.push(\`/watch/\${resumePrompt.slug}\${resumePrompt.history.episode ? \`?episodeId=\${resumePrompt.history.episode.episodeId}\` : ''}\`); }}
                  className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest bg-white text-black hover:bg-white/80 transition rounded-sm shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                >
                  Xem tiếp
                </button>
              </div>
              <button onClick={() => setResumePrompt(null)} className="absolute top-4 right-4 text-white/40 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />`;

content = content.replace(/<AuthModal isOpen=\{authModalOpen\} onClose=\{\(\) => setAuthModalOpen\(false\)\} \/>/, modalUI);

fs.writeFileSync('e:/Study/CSharp2/ProjectTviEn/user-frontend/src/pages/index.tsx', content, 'utf8');
console.log('index.tsx patched successfully');
