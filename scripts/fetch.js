import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { formatHex, converter } from 'culori';

const userColors = [];
let colors = [];

fs.readFileSync(path.normalize("src/userCreations.csv"), "utf8").split('\n').forEach((line, i) => {
  const [name, hex, link] = line.split(',');
  if (name && hex && i !== 0) {
    userColors.push({
      name: name.trim(),
      hex: hex.trim(),
      link: link ? link.trim() : '',
    });
  }
});

const rgbconv = converter('rgb');

const pages = [
  {
    name: "Wikipedia Farbkreis",
    sources: [
      "https://hi.wikipedia.org/wiki/%E0%A4%B0%E0%A4%82%E0%A4%97%E0%A5%8B%E0%A4%82_%E0%A4%95%E0%A5%80_%E0%A4%B8%E0%A5%82%E0%A4%9A%E0%A5%80",
    ],
    parentSelector: "body",
    fn: (_) => {
      const colorList = [];
      const colorTables = document.querySelectorAll(".wikitable");
      const filteredColorTables = Array.from(colorTables).filter(table => {
        const rows = table.querySelectorAll("tr");
        return rows.length > 1;
      });
      filteredColorTables.forEach(table => {
        const rows = table.querySelectorAll("tr");
        rows.forEach((row, i) => {
          if (i === 0) return; // skip header row
          const cells = row.querySelectorAll("td, th");
          if (cells.length < 2) return; // skip rows with less than 2 cells
          // check if fist cell contains a link
          const link = cells[0].querySelector("a");
          const name = link ? link.innerText.trim() : cells[0].innerText.trim();
          const url = link && link.hasAttribute('href') ? link.href : '';

          const hex = cells[2].innerText.trim();
          colorList.push({
            name: name,
            hex: hex,
            link: url,
          });
        });

      });




      return colorList;
    },
  },
];


userColors.forEach(color => {
  if (color.hex) {
    colors.push({
      name: color.name,
      hex: color.hex,
      link: color.hasOwnProperty('link') ? color.link :
      `https://github.com/meodai/farbnamen/#authors-${color.author}`,
    })
  }
});

(async () => {
  const browser = await puppeteer.launch();
  
  for (let j = 0; j < pages.length; j++) {
    for (let i = 0; i < pages[j].sources.length; i++) {
      const page = await browser.newPage();
      console.log(`visiting ${pages[j].sources[i]}`);
      if (Object.keys(pages[j]).includes('parentSelector')) {
        await page.waitForSelector(pages[j].parentSelector);
      } else {
        await page.waitForSelector('body');
      }
      
      await page.goto(pages[j].sources[i]);

      const colorList = await page.evaluate(pages[j].fn);
      colors = colors.concat(colorList);
      // create a cache file for each page in case the page goes down
      // fs.writeFileSync(`./cache/${pages[j].name}.json`, JSON.stringify(colorList, null, 2));
    }
  }

  await browser.close();

  // data sanitization
  

  colors.forEach(c => {
    // remove parentheses and its contents from name
    c.name = c.name.replace(/\(.*\)/, '').trim();
    c.hex = formatHex(c.hex);
    if (!c.hex) {
      console.warn(`invalid hex: ${c.name} (${c.link})`);
    }
  });

  // remove duplicate names from colors list
  // while keeping the first occurence
  colors = colors.filter((c, i) => {
    const referenceName = c.name.toLowerCase();
    const index = colors.findIndex(
      c => c.name.toLowerCase()
                 .localeCompare(
                    referenceName
                  ) === 0
    );
    if (index === i) {
      return true;
    }
    return false;
  });

  // sort colors by name
  colors.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });

  // find duplicate hex values and warn about them
  const hexes = colors.map(c => c.hex);
  const duplicates = hexes.filter((h, i) => hexes.indexOf(h) !== i);
  if (duplicates.length > 0) {
    console.warn('found some duplicate hex values:');
    duplicates.forEach(d => {
      const dupes = colors.filter(c => c.hex === d);
      console.warn(`duplicate hex: ${d} (${dupes.map(c => c.name).join(', ')})`);
      // shift each subsequent duplicate color value by 1
      for (let i = 1; i < dupes.length; i++) {
        dupes[i].hex = shiftColor(dupes[i].hex, (1/255) * i);
      }
    });
  }
  // will probably need to do this recursively
  console.warn('Shifted all the color values a bit to make each color unique');

  function shiftColor(hex, shift) {
    const rgb = rgbconv(hex);
    rgb.r = rgb.r + shift;
    rgb.g = rgb.g + shift;
    rgb.b = rgb.b + shift;
    
    if (rgb.r > 1) {
      rgb.r = 2 - rgb.r;
    }
    if (rgb.g > 1) {
      rgb.g = 2 - rgb.g;
    }
    if (rgb.b > 1) {
      rgb.b = 2 - rgb.b;
    }

    return formatHex(rgb);
  }


  // update color count in readme.md
  // gets SVG template
  let mdTpl = fs.readFileSync(
    './readme.md',
    'utf8'
  ).toString();

  mdTpl = mdTpl.replace(/\(\*{2}(\d+)\*{2}\)/gm, `(**${colors.length}**)`);

  fs.writeFileSync(
    './readme.md',
    mdTpl
  );

  // create a csv file with the colors
  const csv = 'name,hex,link\n' + colors.map(c => `${c.name},${c.hex},${c.link}`).join('\n');
  
  fs.writeFileSync('./colors.csv', csv);
  fs.writeFileSync('./colors.min.json', JSON.stringify(colors));
  fs.writeFileSync('./colors.json', JSON.stringify(colors, null, 2));

  // generate a JS file with export 
  const js = `// generated by scripts/fetch.js\nexport const colorNames = ${JSON.stringify(colors, null, 2)};`;
  fs.writeFileSync('./colors.js', js);
})().catch(e => console.log(e));