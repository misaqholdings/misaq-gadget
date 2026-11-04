// Phase 07 staging-only signed Facebook feed webhook intake.
// No public comment replies or private messages are sent by this handler.
async function phase07CommentWebhook(req,env){
 const respond=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
 if(env.STAGING_MODE!=="isolated-test")return respond({error:"staging_only"},403);
 if(!env.META_APP_SECRET)return respond({error:"signature_configuration_missing"},503);
 const raw=await req.arrayBuffer();if(raw.byteLength>200000)return respond({error:"payload_too_large"},413);
 const signature=req.headers.get("x-hub-signature-256")||"";
 if(!/^sha256=[a-f0-9]{64}$/i.test(signature))return respond({error:"invalid_signature"},403);
 const mac=await crypto.subtle.sign("HMAC",await crypto.subtle.importKey("raw",new TextEncoder().encode(env.META_APP_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]),raw);
 const expected="sha256="+[...new Uint8Array(mac)].map(x=>x.toString(16).padStart(2,"0")).join("");
 let diff=0;for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^signature.toLowerCase().charCodeAt(i);
 if(diff!==0)return respond({error:"invalid_signature"},403);
 let payload;try{payload=JSON.parse(new TextDecoder().decode(raw))}catch{return respond({error:"invalid_json"},400)}
 if(payload.object!=="page"||!Array.isArray(payload.entry))return respond({error:"invalid_page_event"},400);
 let received=0,duplicate=0,ignored=0;
 for(const entry of payload.entry.slice(0,30)){
  const page=String(entry.id||"");if(!/^[0-9]{3,40}$/.test(page)){ignored++;continue}
  for(const change of (entry.changes||[]).slice(0,100)){
   const v=change.value||{};
   if(change.field!=="feed"||v.item!=="comment"||v.verb!=="add"){ignored++;continue}
   const post=String(v.post_id||""),comment=String(v.comment_id||""),from=String(v.from?.id||"");
   if(!/^[0-9_]{3,100}$/.test(post)||!/^[0-9_]{3,100}$/.test(comment)){ignored++;continue}
   const mapped=await env.DB.prepare("SELECT c.id,c.facebook_content_id,m.product_code FROM facebook_contents c LEFT JOIN facebook_content_aliases a ON a.content_id=c.id LEFT JOIN facebook_content_products m ON m.content_id=c.id WHERE c.page_id=? AND (c.facebook_content_id=? OR (a.alias_type='post' AND a.alias_id=?)) AND c.status='active'").bind(page,post,post).all();
   const products=[...new Set(mapped.results.map(x=>x.product_code).filter(Boolean))];
   const contentId=mapped.results[0]?.id??null;
   const status=products.length===0?"unmapped":products.length===1?"single":"multiple";
   const eventKey=page+":"+comment;
   const result=await env.DB.prepare("INSERT OR IGNORE INTO facebook_comment_events(event_key,page_id,post_id,comment_id,commenter_id,comment_text,content_id,product_codes_json,resolution_status) VALUES(?,?,?,?,?,?,?,?,?)").bind(eventKey,page,post,comment,from.slice(0,100),String(v.message||"").slice(0,2000),contentId,JSON.stringify(products),status).run();
   if(result.meta.changes===1)received++;else duplicate++;
  }
 }
 return respond({accepted:true,received,duplicate,ignored,delivery:"pending_review"});
}
