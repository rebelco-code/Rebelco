import fs from 'fs';

const html = fs.readFileSync('canva_dom.html', 'utf8');
const pageMatches = html.matchAll(/aria-label="([^"]*)"/g);
const pages = Array.from(pageMatches).map(m => m[1]).filter(l => l.includes('Page') || l.includes('Slide'));
console.log(pages.slice(0, 15));
