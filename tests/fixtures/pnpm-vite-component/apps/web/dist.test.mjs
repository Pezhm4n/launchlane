import {test} from 'node:test';
import assert from 'node:assert/strict';
import{readFileSync,readdirSync}from'node:fs';
test('built document references a nonempty transformed browser module',()=>{
const html=readFileSync('dist/index.html','utf8');
assert.ok(html.includes('<title>Compiled Vite workspace</title>'));
assert.equal(html.includes('src/main.js'),false);
const scripts=readdirSync('dist/assets').filter(file=>file.endsWith('.js'));assert.equal(scripts.length,1);
const built=readFileSync('dist/assets/'+scripts[0],'utf8');assert.ok(built.length>100);assert.match(built,/Vite component total/);assert.match(built,/Orders total/);
});
