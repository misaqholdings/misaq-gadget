const test = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { resolve } = require("node:path");
let worker;
const origin = "https://gadget.misaqholdings.com";
const endpoint = "https://bridge.test/v1/website/orders";
const env = {ORDER_UPSTREAM_URL:"https://staging.example/api/v1/orders",ORDER_INTEGRATION_TOKEN:"test-secret",TURNSTILE_SECRET:"test-turnstile"};
const order = {product_code:"Q86",order_id:"qa_order_12345678",quantity:1,customer_name:"Test Customer",phone:"01712345678",address:"Dhaka Test Address",turnstile_token:"test-token",marketing_consent:false};
const req = (data=order, method="POST", url=endpoint) => new Request(url,{method,headers:{Origin:origin,"Content-Type":"application/json"},body:method==="POST"?JSON.stringify(data):undefined});
test.before(async()=>{worker=(await import(pathToFileURL(resolve("workers/staging-order-bridge.mjs")).href)).default;});
test("rejects unapproved origin",async()=>{const x=await worker.fetch(new Request(endpoint,{method:"POST",headers:{Origin:"https://evil.example"}}),env);assert.equal(x.status,403);});
test("rejects invalid product and customer without network",async()=>{const x=await worker.fetch(req({...order,product_code:"UNKNOWN"}),env);assert.equal(x.status,400);});
test("rejects missing secret configuration",async()=>{const x=await worker.fetch(req(),{});assert.equal(x.status,503);});
test("verifies challenge and forwards server-only credentials",async()=>{
 const original=global.fetch;const calls=[];
 global.fetch=async(url,init)=>{calls.push({url,init});return String(url).includes("turnstile")?new Response(JSON.stringify({success:true,hostname:"gadget.misaqholdings.com"}),{status:200}):new Response(JSON.stringify({order:{order_id:order.order_id}}),{status:200});};
 try {const x=await worker.fetch(req(),env);assert.equal(x.status,200);assert.equal((await x.json()).order_id,order.order_id);assert.equal(calls.length,2);assert.equal(calls[1].init.headers["x-staging-test-token"],"test-secret");assert.equal(JSON.parse(calls[1].init.body).idempotency_key,order.order_id);}finally{global.fetch=original;}
});
test("rejects failed challenge without forwarding order",async()=>{
 const original=global.fetch;let calls=0;
 global.fetch=async()=>{calls++;return new Response(JSON.stringify({success:false}),{status:200});};
 try {const x=await worker.fetch(req(),env);assert.equal(x.status,403);assert.equal(calls,1);}finally{global.fetch=original;}
});
test("marks transient upstream failures retryable",async()=>{
 const original=global.fetch;
 global.fetch=async(url)=>String(url).includes("turnstile")?new Response(JSON.stringify({success:true,hostname:"gadget.misaqholdings.com"}),{status:200}):new Response(JSON.stringify({error:"down"}),{status:503});
 try {const x=await worker.fetch(req(),env);assert.equal(x.status,503);assert.equal((await x.json()).retryable,true);}finally{global.fetch=original;}
});

test("rejects successful challenge from different hostname",async()=>{const original=global.fetch;let calls=0;global.fetch=async()=>{calls++;return new Response(JSON.stringify({success:true,hostname:"evil.example"}),{status:200});};try{const x=await worker.fetch(req(),env);assert.equal(x.status,403);assert.equal(calls,1);}finally{global.fetch=original;}});

test("maps Q86 to staging catalog only with explicit feature flag",async()=>{
 const original=global.fetch;let upstreamCode;
 global.fetch=async(url,init)=>{if(String(url).includes("turnstile"))return new Response(JSON.stringify({success:true,hostname:"gadget.misaqholdings.com"}),{status:200});upstreamCode=JSON.parse(init.body).product_code;return new Response("{}",{status:200});};
 try {const x=await worker.fetch(req(),{...env,STAGING_Q86_TEST_MAPPING:"enabled"});assert.equal(x.status,200);assert.equal(upstreamCode,"STAGING_TEST_Q86");}finally{global.fetch=original;}
});
test("keeps original product SKU when mapping is disabled",async()=>{
 const original=global.fetch;let upstreamCode;
 global.fetch=async(url,init)=>{if(String(url).includes("turnstile"))return new Response(JSON.stringify({success:true,hostname:"gadget.misaqholdings.com"}),{status:200});upstreamCode=JSON.parse(init.body).product_code;return new Response("{}",{status:200});};
 try {const x=await worker.fetch(req(),env);assert.equal(x.status,200);assert.equal(upstreamCode,"Q86");}finally{global.fetch=original;}
});
