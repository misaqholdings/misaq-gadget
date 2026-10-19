// Phase 06 staging-only order intake bridge. Not deployed.
// Bind a server-side service to submit authenticated orders to the staging API.
// Never include upstream credentials in browser JavaScript.
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    const allowed = origin === "https://gadget.misaqholdings.com";
    const headers = {"Content-Type":"application/json","Cache-Control":"no-store"};
    if (allowed) headers["Access-Control-Allow-Origin"] = origin;
    if (!allowed) return new Response('{"error":"origin_not_allowed"}',{status:403,headers});
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:{...headers,"Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Allow-Headers":"Content-Type"}});
    if (new URL(request.url).pathname !== "/v1/website/orders") return new Response('{"error":"not_found"}',{status:404,headers});
    if (request.method !== "POST") return new Response('{"error":"method_not_allowed"}',{status:405,headers});
    if (!env.ORDER_UPSTREAM_URL || !env.ORDER_INTEGRATION_TOKEN || !env.TURNSTILE_SECRET) return new Response('{"error":"not_configured"}',{status:503,headers});
    let body;
    try {
      const raw = await request.text();
      if (raw.length > 8192) return new Response('{"error":"too_large"}',{status:413,headers});
      body = JSON.parse(raw);
    } catch (_) { return new Response('{"error":"invalid_json"}',{status:400,headers}); }
    if (!["Q86","Q10","AIRFRYER_6L"].includes(body.product_code) || !/^[A-Za-z0-9:_-]{8,128}$/.test(body.order_id || "") || !Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 10 || typeof body.customer_name !== "string" || body.customer_name.trim().length < 2 || body.customer_name.length > 150 || typeof body.phone !== "string" || !/^(?:88)?01[3-9][0-9]{8}$/.test(body.phone.replaceAll(" ","").replaceAll("-","").replaceAll("+","")) || typeof body.address !== "string" || body.address.trim().length < 5 || body.address.length > 500)
      return new Response('{"error":"invalid_order"}',{status:400,headers});
    const challenge = new FormData();
    challenge.set("secret",env.TURNSTILE_SECRET);
    challenge.set("response",body.turnstile_token || "");
    let verified = false;
    try {
      const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",body:challenge});
      const verdict = result.ok ? await result.json() : null;
      verified = verdict?.success === true && verdict.hostname === "gadget.misaqholdings.com";
    } catch (_) {}
    if (!verified) return new Response('{"error":"verification_failed"}',{status:403,headers});
    const mappedCode = env.STAGING_Q86_TEST_MAPPING === "enabled" && body.product_code === "Q86" ? "STAGING_TEST_Q86" : body.product_code;
    const payload = {source:"website",product_code:mappedCode,idempotency_key:body.order_id,quantity:body.quantity,customer_name:body.customer_name,phone:body.phone,address:body.address,acquisition:body.acquisition || "unknown",fbp:body.fbp || null,fbc:body.fbc || null,marketing_consent:body.marketing_consent === true};
    let upstream;
    try {
      upstream = await (env.STAGING_UPSTREAM ? env.STAGING_UPSTREAM.fetch.bind(env.STAGING_UPSTREAM) : fetch)(env.ORDER_UPSTREAM_URL,{method:"POST",headers:{"Content-Type":"application/json","x-staging-test-token":env.ORDER_INTEGRATION_TOKEN,"x-order-source":"website"},body:JSON.stringify(payload)});
    } catch (_) { return new Response('{"error":"upstream_unavailable"}',{status:503,headers}); }
    if (!upstream.ok) {let detail="non_json",kind="other";const ct=upstream.headers.get("content-type")||"";kind=ct.includes("application/json")?"json":ct.includes("text/html")?"html":"other";if(kind==="json"){try{const info=await upstream.json();if(typeof info.error==="string" && /^[a-zA-Z0-9 _-]{1,80}$/.test(info.error))detail=info.error;}catch(_){detail="invalid_json";}}return new Response(JSON.stringify({error:"upstream_rejected",upstream_status:upstream.status,upstream_error:detail,upstream_type:kind,retryable:upstream.status>=500}),{status:upstream.status,headers});}
    return new Response(JSON.stringify({ok:true,order_id:body.order_id}),{status:200,headers});
  }
};
