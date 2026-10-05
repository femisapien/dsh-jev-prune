import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync,statSync} from 'node:fs';
import {dirname,resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const walk=dir=>readdirSync(dir).flatMap(name=>{
  const path=resolve(dir,name);
  if(['.git','node_modules','ci'].includes(name)) return [];
  return statSync(path).isDirectory()?walk(path):[path];
});
for(const file of walk(root).filter(file=>file.endsWith('.md'))){
  for(const match of readFileSync(file,'utf8').matchAll(/\]\(([^)]+)\)/g)){
    const target=match[1].split('#')[0];
    if(!target||/^[a-z]+:/.test(target)||target.includes('<'))continue;
    assert.ok(existsSync(resolve(dirname(file),target)),relative(root,file)+' links to missing '+target);
  }
}
assert.equal((await import('dsh-jev-prune')).name,'jev-prune');
assert.equal((await import('dsh-jev-prune/index.js')).name,'jev-prune');
for(const module of ['jev','prune','receipt','state']){
  assert.ok(Object.keys(await import('dsh-jev-prune/'+module+'.js')).length>0);
}
console.log('Markdown file links, plugin entry and legacy public subpath exports verified.');
