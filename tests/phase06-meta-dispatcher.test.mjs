import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import { dispatchSelectedTestEvents } from "../workers/phase06-staging-meta-dispatcher.mjs";

globalThis.crypto ||= webcrypto;
const ORDER="qa_p06_43795709afb84a958c9cdd72";
function makeDb(){
 const rows=new Map([14,15].map(id=>[id,{id,event_id:"staging:"+ORDER+":"+(id===14?"Lead":"Purchase"),event_name:id===14?"Lead":"Purchase",status:"pending",attempt_count:0,payload_json:JSON.stringify({test_mode:1,dispatch_enabled:0,custom_data:{currency:"BDT",value:650}}),order_id:ORDER,order_status:"delivered"}]));
 const db={prepare(sql){return {bind(...args){return {async first(){return rows.get(args[0])||null},async run(){const id=args.at(-1),r=rows.get(id);if(!r)return {meta:{changes:0}};if(sql.includes("SET status='processing'")){if(r.status!=="pending"||r.attempt_count!==0)return {meta:{changes:0}};r.status="processing";r.attempt_count++;return {meta:{changes:1}};}if(sql.includes("SET status=?")){r.status=args[0];return {meta:{changes:1}};}if(sql.includes("SET status='unknown'")){r.status="unknown";return {meta:{changes:1}};}throw Error("unexpected sql");}}}}}};
 return {db,rows};
}
const cfg=(db,fetchImpl)=>({db,fetchImpl,pixelId:"synthetic_pixel",accessToken:"synthetic_secret",testEventCode:"TEST_SYNTHETIC"});
test("two real lifecycle outbox IDs dispatch once, with no customer identifiers",async()=>{
 const {db,rows}=makeDb();let calls=0;
 const send=async(url,opts)=>{calls++;assert.match(url,/graph.facebook.com/);const body=JSON.parse(opts.body);assert.equal(body.test_event_code,"TEST_SYNTHETIC");assert.equal(body.data.length,1);assert.deepEqual(Object.keys(body.data[0].user_data),["external_id"]);assert.equal(body.data[0].custom_data.value,650);return {ok:true,status:200,json:async()=>({events_received:1})}};
 const result=await dispatchSelectedTestEvents(cfg(db,send));
 assert.equal(calls,2);assert.deepEqual(result.map(x=>x.status),["sent","sent"]);assert.equal(rows.get(14).status,"sent");assert.equal(rows.get(15).status,"sent");
 await dispatchSelectedTestEvents(cfg(db,send));assert.equal(calls,2);
});
test("network ambiguity is quarantined without automatic retries",async()=>{
 const {db,rows}=makeDb();let calls=0;const send=async()=>{calls++;throw Error("timeout")};
 const result=await dispatchSelectedTestEvents(cfg(db,send));
 assert.deepEqual(result.map(x=>x.status),["unknown","unknown"]);assert.equal(calls,2);
 await dispatchSelectedTestEvents(cfg(db,send));assert.equal(calls,2);assert.equal(rows.get(14).status,"unknown");
});
test("incorrect order or event flags fail closed before Meta fetch",async()=>{
 const {db,rows}=makeDb();rows.get(14).order_id="wrong";let calls=0;
 await assert.rejects(dispatchSelectedTestEvents(cfg(db,async()=>{calls++;})),/allowlist_mismatch/);assert.equal(calls,0);
 rows.get(14).order_id=ORDER;rows.get(14).payload_json=JSON.stringify({test_mode:1,dispatch_enabled:1});
 await assert.rejects(dispatchSelectedTestEvents(cfg(db,async()=>{calls++;})),/unsafe_outbox_flags/);assert.equal(calls,0);
});
test("non-allowlisted IDs are rejected",async()=>{
 const {db}=makeDb();await assert.rejects(dispatchSelectedTestEvents({...cfg(db,async()=>{}),ids:[13,14]}),/unexpected_outbox_ids/);
});
