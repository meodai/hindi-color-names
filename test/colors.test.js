import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { colorNames } from '../colors.js';

const read = file => readFile(new URL(`../${file}`, import.meta.url), 'utf8');
const colors = JSON.parse(await read('colors.json'));

test('every color has a name, a valid hex and a link', () => {
  for (const c of colors) {
    assert.ok(c.name, JSON.stringify(c));
    assert.match(c.hex, /^#[0-9a-f]{6}$/, c.name);
    assert.match(c.link, /^https:\/\//, c.name);
  }
});

// a Devanagari name, optionally followed by qualifiers like " (वेब)" or " (X11)"
const namePattern = /^[\p{Script=Devanagari}\p{M}\u200C\u200D -]+?( \([^()#]+\))*$/u;

test('names are NFC-normalized Devanagari without enumerations, codes or junk', () => {
  for (const c of colors) {
    assert.equal(c.name, c.name.normalize('NFC'), c.name);
    assert.match(c.name, namePattern, c.name);
    // digits are only allowed inside qualifiers
    assert.doesNotMatch(c.name.replace(/ \([^()]+\)/g, ''), /[\d\u0966-\u096F]/u, c.name);
    // "(रंग)" only disambiguates Wikipedia articles
    assert.doesNotMatch(c.name, /\(रंग\)/u, c.name);
    // a nukta belongs directly after its consonant, not after a vowel sign
    assert.doesNotMatch(c.name, /[\u093E-\u094C]\u093C/u, c.name);
  }
});

test('names are unique', () => {
  const names = colors.map(c => c.name.normalize('NFC'));
  assert.equal(new Set(names).size, names.length);
});

test('hex values are unique', () => {
  const hexes = colors.map(c => c.hex);
  assert.equal(new Set(hexes).size, hexes.length);
});

test('user creations keep their hex values', async () => {
  const [, ...rows] = (await read('src/userCreations.csv')).trim().split('\n');
  const hexes = new Set(colors.map(c => c.hex));
  for (const row of rows) {
    const [name, hex] = row.split(',');
    assert.ok(hexes.has(hex.trim().toLowerCase()), name);
  }
});

const csvField = value => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

test('colors.js, minified json and csv match colors.json', async () => {
  assert.deepEqual(colorNames, colors);
  assert.deepEqual(JSON.parse(await read('colors.min.json')), colors);
  const csv = (await read('colors.csv')).trim().split('\n');
  assert.equal(csv[0], 'name,hex,link');
  assert.deepEqual(csv.slice(1), colors.map(c => [c.name, c.hex, c.link].map(csvField).join(',')));
});

test('readme count matches', async () => {
  assert.match(await read('README.md'), new RegExp(`\\(\\*\\*${colors.length}\\*\\*\\)`));
});
