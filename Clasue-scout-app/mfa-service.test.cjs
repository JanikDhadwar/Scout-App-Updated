const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {createMfaService}=require('./mfa-service.cjs');

const key=crypto.randomBytes(32).toString('base64');
const file=()=>path.join(fs.mkdtempSync(path.join(os.tmpdir(),'argus-mfa-')),'mfa.json');

test('TOTP enrollment requires a valid confirmation and creates recovery codes',()=>{
 let now=Date.UTC(2026,9,28,12),filename=file(),service=createMfaService(filename,key,{now:()=>now});
 const enrollment=service.begin('owner','owner');assert.equal(service.enrolled('owner'),false);
 assert.throws(()=>service.confirm('owner',enrollment.enrollment_id,'000000'),/incorrect/);
 const {hotp}=require('./mfa-service.cjs'),confirmed=service.confirm('owner',enrollment.enrollment_id,hotp(enrollment.secret,Math.floor(now/30000)));
 assert.equal(confirmed.recovery_codes.length,10);assert.equal(service.enrolled('owner'),true);
});

test('MFA login rejects replay, accepts one recovery code once and persists without plaintext secrets',()=>{
 let now=Date.UTC(2026,9,28,12),filename=file(),service=createMfaService(filename,key,{now:()=>now});
 const enrollment=service.begin('owner','owner');
 // Enrollment secret is intentionally shown once; derive the current code in an
 // isolated service helper by reproducing the RFC counter.
 const {hotp}=require('./mfa-service.cjs'),code=hotp(enrollment.secret,Math.floor(now/30000));
 const {recovery_codes}=service.confirm('owner',enrollment.enrollment_id,code);
 const stored=fs.readFileSync(filename,'utf8');assert.ok(!stored.includes(enrollment.secret));assert.ok(!stored.includes(recovery_codes[0]));
 now+=30000;
 const first=service.startLogin('owner');assert.equal(service.verify(first.challenge_id,hotp(enrollment.secret,Math.floor(now/30000))),'owner');
 const replay=service.startLogin('owner');assert.throws(()=>service.verify(replay.challenge_id,hotp(enrollment.secret,Math.floor(now/30000))),/incorrect/i);
 const recovery=service.startLogin('owner');assert.equal(service.verify(recovery.challenge_id,recovery_codes[0]),'owner');
 const reused=service.startLogin('owner');assert.throws(()=>service.verify(reused.challenge_id,recovery_codes[0]),/incorrect/i);
 service=createMfaService(filename,key,{now:()=>now+30000});assert.equal(service.enrolled('owner'),true);
});

test('MFA private data fails closed without the configured encryption key',()=>{
 const filename=file(),service=createMfaService(filename,key),enrollment=service.begin('owner','owner'),{hotp}=require('./mfa-service.cjs');
 service.confirm('owner',enrollment.enrollment_id,hotp(enrollment.secret,Math.floor(Date.now()/30000)));
 assert.throws(()=>createMfaService(filename,''),/unavailable/);
 assert.throws(()=>createMfaService(file(),'not-base64'),/32-byte/);
});

test('MFA private storage rejects symbolic links',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'argus-mfa-link-')),target=path.join(directory,'target.json'),linked=path.join(directory,'mfa.json');
 fs.writeFileSync(target,JSON.stringify({version:1,users:{}}));fs.symlinkSync(target,linked);
 assert.throws(()=>createMfaService(linked,key),/symbolic link/);
 assert.deepEqual(JSON.parse(fs.readFileSync(target,'utf8')),{version:1,users:{}});
});
