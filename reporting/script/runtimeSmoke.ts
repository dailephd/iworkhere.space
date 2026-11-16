import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const runId='b2-production-runtime-'+new Date().toISOString().replace(/[:.]/g,'-');
const report=path.resolve('test-report',runId);mkdirSync(report,{recursive:true});
const reservation=createServer();await new Promise<void>(resolve=>reservation.listen(0,'127.0.0.1',()=>resolve()));const address=reservation.address(); if(!address || typeof address === 'string') throw new Error('Fixture address unavailable'); const port=address.port;await new Promise(resolve=>reservation.close(resolve));
const env: NodeJS.ProcessEnv={...process.env,NEXT_TELEMETRY_DISABLED:'1'};for(const key of Object.keys(env))if(/^(REPORTING_|OBSERVABILITY_|SUPPORT_)/.test(key))delete env[key];
const child=spawn(process.execPath,[path.resolve('node_modules/next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:process.cwd(),env,windowsHide:true,stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',data=>log+=data);child.stderr.on('data',data=>log+=data);
const check: string[]=[];
try {
 let ready=false;for(let i=0;i<100;i++){try{const response=await fetch(`http://127.0.0.1:${port}/.well-known/oauth-protected-resource`);if(response.status===503){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,100));}assert.ok(ready,'production runtime readiness');
 for(const [route,method] of [['/mcp','POST'],['/mcp','GET'],['/.well-known/oauth-protected-resource','GET']]){
  const response=await fetch(`http://127.0.0.1:${port}${route}`,{method,headers:{'Content-Type':'application/json'},...(method==='POST'?{body:JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'observability_report',arguments:{schemaVersion:1,range:'24h'}}})}:{})});
  const body=await response.text();assert.equal(response.status,503);assert.deepEqual(JSON.parse(body),{error:'configuration_unavailable'});assert.equal(response.headers.get('cache-control'),'no-store');assert.ok(!/stack|password|postgresql|navigationCount/.test(body));check.push(`${method} ${route}: fail-closed production runtime PASS`);
 }
 function files(directory: string): string[]{return readdirSync(directory,{withFileTypes:true}).flatMap(item=>item.isDirectory()?files(path.join(directory,item.name)):[path.join(directory,item.name)]);}
 const client=files('.next/static').filter(file=>file.endsWith('.js'));
 for(const file of client){const source=readFileSync(file,'utf8');assert.ok(!/REPORTING_DATABASE_URL|REPORTING_INTROSPECTION_CLIENT_SECRET|REPORTING_ALLOWED_SUBJECTS/.test(source));}
 const server=files('.next/server').filter(file=>file.endsWith('.js'));
 for(const file of server){const source=readFileSync(file,'utf8');assert.ok(!/FROM observability\.error_diagnostic|support\.dashboard_report|Resize worker initialization failed/.test(source));}
 check.push('no reporting secret identifiers in client bundles PASS');check.push('no diagnostic/support SQL or synthetic fixtures in production server bundle PASS');
 writeFileSync(path.join(report,'results.json'),JSON.stringify({runId,status:'PASS',check},null,2));console.log(runId,check);
}finally{child.kill();await new Promise(resolve=>{child.once('exit',resolve);setTimeout(resolve,3000);});writeFileSync(path.join(report,'runtime.log'),log);}
