import { readFile, writeFile } from 'node:fs/promises';
import puppeteer from 'puppeteer';
import { formatHex, converter } from 'culori';

const rgbconv = converter('rgb');
const file = path => new URL(`../${path}`, import.meta.url);

const pages = [
  {
    name: 'Wikipedia: रंगों की सूची',
    sources: [
      'https://hi.wikipedia.org/wiki/%E0%A4%B0%E0%A4%82%E0%A4%97%E0%A5%8B%E0%A4%82_%E0%A4%95%E0%A5%80_%E0%A4%B8%E0%A5%82%E0%A4%9A%E0%A5%80',
    ],
    parentSelector: '.wikitable',
    fn: _ => {
      const colorList = [];
      const colorTables = [...document.querySelectorAll('.wikitable')]
        .filter(table => table.querySelectorAll('tr').length > 1);

      for (const table of colorTables) {
        const rows = table.querySelectorAll('tr');
        rows.forEach((row, i) => {
          if (i === 0) return; // skip header row
          const cells = row.querySelectorAll('td, th');
          if (cells.length < 3) return;
          // the first cell usually links to the article about the color
          const link = cells[0].querySelector('a');
          const name = link ? link.innerText.trim() : cells[0].innerText.trim();
          const url = link && link.hasAttribute('href') ? link.href : '';
          const hex = cells[2].innerText.trim();
          colorList.push({ name, hex, link: url });
        });
      }

      return colorList;
    },
  },
];

// src/userCreations.csv: name,hex,author[,link]
const [header, ...rows] = (await readFile(file('src/userCreations.csv'), 'utf8')).trim().split('\n');
const columns = header.split(',').map(col => col.trim());
const userColors = rows
  .map(line => Object.fromEntries(line.split(',').map((value, i) => [columns[i], value.trim()])))
  .filter(color => color.name && color.hex);

let colors = userColors.map(color => ({
  name: color.name,
  hex: color.hex,
  link: color.link || `https://github.com/${color.author}`,
}));
const userCreated = new Set(colors);

const browser = await puppeteer.launch();
let scraped = 0;

try {
  for (const { sources, fn, parentSelector = 'body' } of pages) {
    for (const source of sources) {
      const page = await browser.newPage();
      console.log(`visiting ${source}`);
      try {
        await page.goto(source);
        await page.waitForSelector(parentSelector);
        const colorList = await page.evaluate(fn);
        scraped += colorList.length;
        colors.push(...colorList);
      } catch (e) {
        console.warn(`could not scrape ${source}: ${e.message}`);
      } finally {
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}

if (!scraped) throw new Error('no colors could be scraped, keeping the existing files');

// data sanitization
// Devanagari: compose to NFC and move a nukta that was typed after a vowel sign
// back onto its consonant ("आडू़" -> "आड़ू"), NFC does not reorder these
const normalizeName = name => name
  .normalize('NFC')
  .replace(/([\u093E-\u094C]+)\u093C/g, '\u093C$1')
  .normalize('NFC');

// a "/" or "#" outside of parentheses separates alternative names
const separator = /[#/](?![^()]*\))/;

for (const c of [...colors]) {
  // "हरा HTML/CSS" and "पर्पल(HTML/CSS)" both become "… (HTML/CSS)"
  c.name = normalizeName(c.name).replace(/\s*\(?HTML\/CSS\)?/, ' (HTML/CSS)');

  // if a name contains a # or / split it and create a new entry with the same hex
  if (separator.test(c.name)) {
    const [first, ...others] = c.name.split(separator);
    for (const name of others) colors.push({ name, hex: c.hex, link: c.link });
    c.name = first;
  }
}

for (const c of colors) {
  // "(रंग)" ("color") only disambiguates Wikipedia articles, other qualifiers like
  // "(वेब)" or "(X11)" tell distinct colors apart and are kept, with one space before them
  c.name = c.name
    .replace(/\(\s*रंग\s*\)/g, '')
    .replace(/\s*\(\s*/g, ' (')
    .replace(/\s*\)/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
  c.hex = formatHex(c.hex);
  if (!c.hex) console.warn(`invalid hex, dropping: ${c.name} (${c.link})`);
}
colors = colors.filter(c => c.name && c.hex);

// remove duplicate names while keeping the first occurrence
const seenNames = new Set();
colors = colors.filter(c => {
  const key = c.name.normalize('NFC').toLowerCase();
  if (seenNames.has(key)) return false;
  seenNames.add(key);
  return true;
});

const collator = new Intl.Collator('hi');
colors.sort((a, b) => collator.compare(a.name, b.name));

// find duplicate hex values and shift each subsequent one a bit to make each color unique,
// user creations always keep their hex
const byHex = Map.groupBy(colors, c => c.hex);
const usedHexes = new Set(byHex.keys());
for (const [hex, group] of byHex) {
  if (group.length < 2) continue;
  console.warn(`duplicate hex: ${hex} (${group.map(c => c.name).join(', ')})`);
  const dupes = group.toSorted((a, b) => userCreated.has(b) - userCreated.has(a));
  for (const c of dupes.slice(1)) {
    let step = 1;
    let shifted;
    do {
      shifted = shiftColor(hex, step++ / 255);
    } while (usedHexes.has(shifted));
    c.hex = shifted;
    usedHexes.add(shifted);
  }
}

function shiftColor(hex, shift) {
  const rgb = rgbconv(hex);
  for (const channel of ['r', 'g', 'b']) {
    rgb[channel] += shift;
    if (rgb[channel] > 1) rgb[channel] = 2 - rgb[channel];
  }
  return formatHex(rgb);
}

// update color count in README.md
const readme = await readFile(file('README.md'), 'utf8');
await writeFile(file('README.md'), readme.replace(/\(\*{2}(\d+)\*{2}\)/gm, `(**${colors.length}**)`));

const csvField = value => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
const csv = 'name,hex,link\n' + colors.map(c => [c.name, c.hex, c.link].map(csvField).join(',')).join('\n');

await writeFile(file('colors.csv'), csv);
await writeFile(file('colors.min.json'), JSON.stringify(colors));
await writeFile(file('colors.json'), JSON.stringify(colors, null, 2));
await writeFile(
  file('colors.js'),
  `// generated by scripts/fetch.js\nexport const colorNames = ${JSON.stringify(colors, null, 2)};`,
);
