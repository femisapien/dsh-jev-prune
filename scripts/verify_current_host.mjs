/** Disposable CLI install + real preset activation, without model requests. */
import assert from 'node:assert/strict'
import {existsSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {dirname,join,resolve} from 'node:path'
import {fileURLToPath,pathToFileURL} from 'node:url'
import {spawn,spawnSync} from 'node:child_process'
import {createServer} from 'node:net'

const repo=resolve(dirname(fileURLToPath(import.meta.url)),'..')
const npmCli=process.env.npm_execpath
assert.ok(npmCli?.endsWith('.js'),'Run through npm run verify:current-host')
const arg=process.argv.indexOf('--host-dir')
const host=arg<0?mkdtempSync(join(tmpdir(),'dsh-host-verification-')):resolve(process.argv[arg+1])
const run=(program,args,cwd=repo,env=process.env)=>{
  const result=spawnSync(program,args,{cwd,env,encoding:'utf8',timeout:600000,maxBuffer:4*1024*1024,windowsHide:true})
  assert.equal(result.status,0,(result.stderr||result.stdout||String(result.error)).replace(/([?&]token=)[^\s]+/g,'$1<redacted>'))
  return result.stdout
}
if(arg<0){
  const spec=process.env.DSH_VERIFY_SPEC||'@deepseek-ai/dsh@next'
  console.log('Installing isolated host:',spec)
  run(process.execPath,[npmCli,'install','--prefix',host,'--ignore-scripts','--no-audit','--no-fund',spec])
}
const bin=join(host,'node_modules/@deepseek-ai/dsh/lib/bin.js')
assert.ok(existsSync(bin))
const version=JSON.parse(readFileSync(join(host,'node_modules/@deepseek-ai/dsh/package.json'),'utf8')).version
const home=mkdtempSync(join(host,'verification-home-'))
const env={...process.env,DSH_HOME:home,TYPESAFE_API_KEY:''}
const archive=JSON.parse(run(process.execPath,[npmCli,'pack','--json','--pack-destination',home]))[0].filename
const packed=join(home,archive)
run(process.execPath,[bin,'plugin','--profile','web','add',packed,'--ignore-scripts'],repo,env)
const dump=run(process.execPath,[bin,'--profile','web','--dump-config'],repo,env)
assert.match(dump,/name: dsh-jev-prune/)
const addon=join(home,'profiles/web/node_modules/dsh-jev-prune')
run(process.execPath,[join(addon,'test/check.js')],host,env)
run(process.execPath,[join(addon,'test/smoke_apply.mjs')],host,env)
const heartbeat=join(home,'heartbeat.json'),resultPath=join(home,'activation.json')
const probe=join(home,'probe.mjs')
writeFileSync(probe,`import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {agentEvents} from '@deepseek-ai/dsh-agent';
import {serviceForAgent} from '@deepseek-ai/dsh-agent-preset-registry';
export const inject=['agents','agentPresets'];
export function apply(ctx){ctx.effect(()=>{const timer=setTimeout(async()=>{let handle;try{
handle=await ctx.agents.create({sessionId:randomUUID(),meta:{cwd:${JSON.stringify(host)},agentPreset:'standard'},setup:async scope=>{await ctx.agentPresets.mount(scope,'standard')}});
const agent=handle.agent;
await agentEvents(ctx,agent).waterfall('agent/pre-step',{signal:new AbortController().signal,messages:[],turn:0,step:0},async()=>({kind:'enter',messages:[]}));
const state=JSON.parse(readFileSync(${JSON.stringify(heartbeat)},'utf8'));
writeFileSync(${JSON.stringify(resultPath)},JSON.stringify({success:true,pruner:typeof serviceForAgent(ctx,agent,'toolResultPruner')?.pruneSession,compaction:typeof serviceForAgent(ctx,agent,'compaction')?.compactRegion,takeover:state.takeover,summaryHook:state.summaryHook,compatibility:state.compatibility}));
}catch(error){writeFileSync(${JSON.stringify(resultPath)},JSON.stringify({success:false,error:String(error)}));}finally{await handle?.dispose();}},2000);return()=>clearTimeout(timer);});}
`)
// This profile was created solely by this verification run.
writeFileSync(join(home,'profiles/web/cordis.patch.yml'),
  '- id: jev-prune\n  config:\n    dryRun: true\n    heartbeatFile: '+JSON.stringify(heartbeat)+'\n- insert:\n    - id: activation-probe\n      name: '+JSON.stringify(pathToFileURL(probe).href)+'\n')
const server=createServer()
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const port=server.address().port
await new Promise(resolve=>server.close(resolve))
let diagnostic=''
const child=spawn(process.execPath,[bin,'--profile','web','--no-open','--port',String(port)],{cwd:repo,env,windowsHide:true,stdio:['ignore','pipe','pipe']})
child.stdout.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-20000)})
child.stderr.on('data',chunk=>{diagnostic=(diagnostic+chunk).slice(-20000)})
try{
  const deadline=Date.now()+90000
  while(!existsSync(resultPath)&&Date.now()<deadline&&child.exitCode===null)await new Promise(resolve=>setTimeout(resolve,250))
  assert.ok(existsSync(resultPath),diagnostic.replace(/([?&]token=)[^\s]+/g,'$1<redacted>'))
  const result=JSON.parse(readFileSync(resultPath,'utf8'))
  assert.equal(result.success,true,result.error)
  assert.equal(result.takeover.installed,true)
  assert.equal(result.summaryHook.installed,true)
  console.log(JSON.stringify({hostVersion:version,installation:'passed',configuration:'passed',realPresetActivation:'passed',addonSmokeChecks:'passed',modelInference:'not invoked',artifact:resultPath},null,2))
}finally{
  if(child.exitCode===null)child.kill('SIGTERM')
}
