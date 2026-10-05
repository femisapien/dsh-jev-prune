import assert from 'node:assert/strict';
import {mkdirSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {apply} from '../index.js';
import {eventText} from '../src/state.js';
import {makeSession,makePruner,makeCtx,fakeJudge} from './fixtures.mjs';

const session=makeSession();
const events=[...session.surface.nodes].map(seq=>session.eventAt(seq));
session.snapshotEvents=()=>events;
const append=session.append.bind(session);
session.append=(...args)=>{const result=append(...args); events.push(session.eventAt(result.seq)); return result;};
const original=eventText(session.eventAt(session.seqs.s1));
const protectedOriginal=eventText(session.eventAt(session.seqs.s3));
const pruner=makePruner();
const compaction={
  async summarize(){throw Error('Demo must inject a deterministic receipt');},
  async compactRegion(start,end,agent,signal){
    const nodes=session.surface.nodes;
    const seqs=nodes.slice(nodes.indexOf(start),nodes.indexOf(end)+1);
    const result=await this.summarize({messages:seqs.map(seq=>session.deriveEventMessage(session.eventAt(seq)))},agent,signal);
    assert.equal(result.provider,'jev-receipt');
    const compactionId='demo-region-1';
    const record=session.append('compaction/summary',{compactionId,shadowedRange:{start,end},shadowedSeqs:seqs,summary:result.summary});
    session.append('user/message',{source:{kind:'plugin',plugin:'compact',compactionId},content:result.summary},{surfaceOp:{op:'replace',startSeq:start,endSeq:end},sourceEventSeqs:seqs});
    return {compactionId,shadowedSeqs:seqs,recordSeq:record.seq};
  }
};
const ctx=makeCtx({session,pruner,compaction});
const judge=fakeJudge({3:0.05,5:0.06,7:0.95},{3:0.05,5:0.05,7:0.9});
apply(ctx,{judgeOn:'always',compactOn:'off',preserveRecent:0,compactPreserveRecent:0,compactMode:'absolute',compactThreshold:0.2,compactMinChars:1000,keepMode:'absolute',logLevel:'silent'},{judge});
const exec={agent:{session,options:{}}};
const stages=[];
const stage=(title,lines)=>{stages.push({title,lines}); console.log('\n'+title+'\n'+lines.join('\n'));};
stage('01 / Inspect long tool output',[
  'REAL PLUGIN / SIMULATED DSH HOST / FIXED JUDGE SCORES',
  'No live TypeSafe requests. No live-host compatibility claim.',
  'Read s3: 6,000 characters; keep score 0.05',
  'Read s7: 6,000 characters; keep score 0.95 (protected)',
]);
await ctx.waterfall('agent/pre-step',exec,()=>{});
const trimmed=pruner.pruneSession(session);
assert.equal(trimmed.pruned.length,2);
assert.equal(eventText(session.eventAt(7)),protectedOriginal);
const replacement=trimmed.pruned.find(row=>row.originalSeq===3);
assert.ok(replacement);
assert.ok(eventText(session.eventAt(replacement.replacementSeq)).length<original.length);
stage('02 / Trim spent output; preserve useful evidence',[
  'Actual pruneSession result: '+trimmed.pruned.length+' outputs trimmed',
  's3: '+replacement.charsBefore+' -> '+replacement.charsAfter+' characters',
  's7: unchanged, byte-for-byte equality assertion passed',
  'Original s3 remains in the session event log',
]);
const compact=ctx.registeredTools.find(tool=>tool.name==='jev_compact_now');
await compact.execute({},exec);
const summary=events.find(event=>event.type==='compaction/summary');
assert.ok(summary,'A real plugin receipt must be injected');
stage('03 / Inject a deterministic region receipt',[
  'jev_compact_now invoked the real registered tool',
  'Provider: jev-receipt / Model: deterministic',
  'Original region: s'+summary.data.shadowedRange.start+'-s'+summary.data.shadowedRange.end,
  'Protected s7 remains on the surface',
  ...eventText(summary).split('\n').slice(0,4),
]);
assert.ok(session.surface.nodes.includes(7));
const restore=ctx.registeredTools.find(tool=>tool.name==='jev_restore');
const before=[...session.surface.nodes];
const restored=await restore.execute({seq:summary.seq},exec);
assert.ok(restored.includes('a'.repeat(600)));
assert.deepEqual(session.surface.nodes,before);
stage('04 / Retrieve checkpoint text without changing the surface',[
  'jev_restore({ seq: '+summary.seq+' }) returned hidden region text',
  'Archived tool output excerpt found: assertion passed',
  'Surface unchanged: assertion passed',
  'Scope: REGION checkpoint only; each event is capped at 4,000 units',
  'Layer-1 / partial-result IDs are not directly restorable yet',
  'All demonstration assertions passed',
]);
const assets=fileURLToPath(new URL('../assets/',import.meta.url));
mkdirSync(assets,{recursive:true});
writeFileSync(assets+'demo.json',JSON.stringify({format:1,host:'simulated',judge:'fixed probabilities',liveApiCalls:0,stages,assertionsPassed:true},null,2)+'\n');
const cast=[JSON.stringify({version:2,width:120,height:24,title:'dsh-jev-prune deterministic demo (simulated host)',env:{TERM:'xterm-256color'}})];
stages.forEach((item,i)=>cast.push(JSON.stringify([i*6,'o','\u001b[2J\u001b[H'+item.title+'\r\n\r\n'+item.lines.join('\r\n')+'\r\n'])));
cast.push(JSON.stringify([24,'o','\r\nDemo complete.\r\n']));
writeFileSync(assets+'demo.cast',cast.join('\n')+'\n');
