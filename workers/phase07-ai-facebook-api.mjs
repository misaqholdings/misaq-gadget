
// Reusable background sync. Uses the same logic as admin-triggered sync.
// Never creates products, never overwrites existing mappings.
async function phase07ScheduledSync(env){
 if(!env.DB||!env.FACEBOOK_PAGE_ACCESS_TOKEN||!env.FACEBOOK_PAGE_ID)return {skipped:"not_configured"};
 const page=String(env.FACEBOOK_PAGE_ID);
 if(!/^[0-9]{3,40}$/.test(page))return {skipped:"invalid_page_id"};
 const endpoint=new URL("https://graph.facebook.com/v23.0/"+page+"/posts");
 endpoint.searchParams.set("fields","id,message,permalink_url,created_time");
 endpoint.searchParams.set("limit","50");
 let next=endpoint.toString(),pages=0,created=0,updated=0,auto_mapped=0,needs_review=0;
 while(next&&pages<10){
  const u=new URL(next);
  if(u.origin!=="https://graph.facebook.com"||!u.pathname.startsWith("/v23.0/"))throw Error("unsafe_pagination");
  const response=await fetch(u,{headers:{authorization:"Bearer "+env.FACEBOOK_PAGE_ACCESS_TOKEN},signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error("facebook_sync_http_"+response.status);
  const data=await response.json();
  if(!Array.isArray(data.data))throw Error("invalid_graph_response");
  const counts=await syncContent(env.DB,page,data.data);
  created+=counts.created;updated+=counts.updated;auto_mapped+=counts.auto_mapped;needs_review+=counts.needs_review;
  next=data.paging?.next||null;pages++;
 }
 return {created,updated,auto_mapped,needs_review,pages,has_more:!!next};
}

// Phase 07 automatic content-to-existing-product matching.
// Conservative deterministic identification; never creates products or overwrites admin mapping.
function identifyProducts(post, products) {
 const raw=[post.message,post.name,post.description].filter(x=>typeof x==="string").join(" ").toLowerCase();
 const matches=[];
 for(const p of products){
  const code=String(p.product_code||"").toLowerCase();
  const name=String(p.product_name||"").toLowerCase().trim();
  const short=String(p.short_name||"").toLowerCase().trim();
  const terms=[code,name,short].filter(x=>x.length>=3);
  const matched=terms.some(term=>{
   const escaped=term.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
   return new RegExp("(^|[^\\p{L}\\p{N}])"+escaped+"(?=$|[^\\p{L}\\p{N}])","iu").test(raw);
  });
  if(matched)matches.push(p.product_code);
 }
 return [...new Set(matches)];
}
async function syncContent(db,pageId,posts) {
 const products=(await db.prepare("SELECT product_code,product_name,short_name FROM products WHERE status='active'").all()).results;
 const stats={created:0,updated:0,auto_mapped:0,needs_review:0};
 for(const post of posts){
  const id=String(post.id||"");
  if(!/^[0-9_]{3,100}$/.test(id))continue;
  const existing=await db.prepare("SELECT id,sync_status FROM facebook_contents WHERE page_id=? AND facebook_content_id=?").bind(pageId,id).first();
  await db.prepare("INSERT INTO facebook_contents(page_id,facebook_content_id,content_type,post_message,permalink,source) VALUES(?,?,'post',?,?,'api') ON CONFLICT(page_id,facebook_content_id) DO UPDATE SET post_message=excluded.post_message,permalink=excluded.permalink,updated_at=CURRENT_TIMESTAMP").bind(pageId,id,String(post.message||"").slice(0,10000),String(post.permalink_url||"").slice(0,2000)).run();
  if(existing)stats.updated++;else stats.created++;
  // Never replace reviewed/manual mappings or existing product links.
  const content=await db.prepare("SELECT id,sync_status FROM facebook_contents WHERE page_id=? AND facebook_content_id=?").bind(pageId,id).first();
  const current=await db.prepare("SELECT COUNT(*) AS n FROM facebook_content_products WHERE content_id=?").bind(content.id).first();
  if(current.n>0||content.sync_status==="mapped")continue;
  const codes=identifyProducts(post,products);
  if(codes.length===0){stats.needs_review++;continue}
  await db.batch([...codes.map((code,i)=>db.prepare("INSERT OR IGNORE INTO facebook_content_products(content_id,product_code,is_primary) VALUES(?,?,?)").bind(content.id,code,i===0?1:0)),db.prepare("UPDATE facebook_contents SET sync_status='mapped',updated_at=CURRENT_TIMESTAMP WHERE id=? AND sync_status='unmapped'").bind(content.id)]);
  stats.auto_mapped+=codes.length;
 }
 return stats;
}

// Phase 07: staging-only AI knowledge and organic/paid Facebook content management.
async function phase07Intelligence(req,env,p,role,staff,actorId){
 const json=(v,s=200)=>new Response(JSON.stringify(v),{status:s,headers:{"content-type":"application/json","cache-control":"no-store"}});
 const err=(e,s=400)=>json({error:e},s);
 if(p.startsWith("/api/v1/intelligence/bot/")){
  if(role!=="integration"&&role!=="admin")return err("integration_required",403);
  const productCode=p.split("/").filter(Boolean)[4];
  if(req.method!=="GET"||!productCode||!/^[A-Z0-9_-]{3,64}$/.test(productCode))return err("not_found",404);
  const row=await env.DB.prepare("SELECT p.product_code,p.product_name,p.sale_price,p.currency,p.status,k.specifications_json,k.faq_json,k.sales_instructions,k.escalation_rules,k.verified_information,k.prohibited_claims,k.features,k.package_contents,k.delivery_policy,k.payment_methods,k.warranty_policy,k.return_policy,k.version FROM products p JOIN product_ai_knowledge k ON k.product_code=p.product_code WHERE p.product_code=? AND p.status='active' AND k.approval_status='published'").bind(productCode).first();
  return row?json({product:row}):err("published_product_not_found",404);
 }
 if(role!=="admin"||!staff)return err("admin_staff_required",403);
 const parts=p.split("/").filter(Boolean),kind=parts[3],key=parts[4],sub=parts[5],method=req.method;
 const body=async()=>{const b=await req.json();if(!b||typeof b!=="object"||Array.isArray(b))throw Error("invalid_json");return b};
 const code=v=>typeof v==="string"&&/^[A-Z0-9_-]{3,64}$/.test(v);
 const text=(v,n=10000)=>typeof v==="string"&&v.length<=n;
 const audit=(type,id,action,oldV,newV)=>env.DB.prepare("INSERT INTO audit_logs(entity_type,entity_id,action,actor_type,actor_id,old_values_json,new_values_json) VALUES(?,?,?,'admin',?,?,?)").bind(type,String(id),action,actorId,JSON.stringify(oldV),JSON.stringify(newV));
 try{
 if(kind==="knowledge"&&key&&method==="GET"){
 if(!code(key))return err("invalid_code");
 const product=await env.DB.prepare("SELECT product_code,product_name,sale_price,currency,status FROM products WHERE product_code=?").bind(key).first();
 if(!product)return err("not_found",404);
 const knowledge=await env.DB.prepare("SELECT * FROM product_ai_knowledge WHERE product_code=?").bind(key).first();
 return json({product,knowledge});
 }
 if(kind==="knowledge"&&key&&method==="PUT"){
 if(!code(key))return err("invalid_code");const b=await body();
 const allowed=["specifications","faq","sales_instructions","escalation_rules","verified_information","prohibited_claims","features","package_contents","delivery_policy","payment_methods","warranty_policy","return_policy"];
 if(!Object.keys(b).length||Object.keys(b).some(k=>!allowed.includes(k)))return err("invalid_fields");
 const product=await env.DB.prepare("SELECT product_code FROM products WHERE product_code=?").bind(key).first();if(!product)return err("not_found",404);
 const old=await env.DB.prepare("SELECT * FROM product_ai_knowledge WHERE product_code=?").bind(key).first();
 if(old&&old.approval_status!=="draft")return err("return_to_draft_before_editing",409);
 const data={};for(const field of allowed){
   const value=b[field]??(old?(field==="specifications"||field==="faq"?JSON.parse(old[field+"_json"]):old[field]):(field==="specifications"?{}:field==="faq"?[]:""));
   if(field==="specifications"){if(!value||typeof value!=="object"||Array.isArray(value)||JSON.stringify(value).length>10000)return err("invalid_specifications");data.specifications_json=JSON.stringify(value)}
   else if(field==="faq"){if(!Array.isArray(value)||value.length>100||JSON.stringify(value).length>30000||value.some(x=>!x||!text(x.question,500)||!text(x.answer,2000)))return err("invalid_faq");data.faq_json=JSON.stringify(value)}
   else{if(!text(value))return err("invalid_"+field);data[field]=value}
 }
 const cols=Object.keys(data),vals=Object.values(data);
 await env.DB.prepare("INSERT INTO product_ai_knowledge(product_code,"+cols.join(",")+") VALUES(?,"+cols.map(()=>"?").join(",")+") ON CONFLICT(product_code) DO UPDATE SET "+cols.map(k=>k+"=excluded."+k).join(",")+",version=product_ai_knowledge.version+1,updated_at=CURRENT_TIMESTAMP").bind(key,...vals).run();
 await audit("product_knowledge",key,"draft_saved",{version:old?.version??0},{version:(old?.version??0)+1}).run();
 return json({saved:true,product_code:key,approval_status:"draft"});
 }
 if(kind==="knowledge"&&key&&sub==="transition"&&method==="POST"){
 const b=await body(),target=b.status;
 if(!["draft","review","approved","published"].includes(target))return err("invalid_status");
 const old=await env.DB.prepare("SELECT approval_status,version,verified_information FROM product_ai_knowledge WHERE product_code=?").bind(key).first();
 if(!old)return err("not_found",404);
 const transitions={draft:["review"],review:["draft","approved"],approved:["draft","published"],published:["draft"]};
 if(!transitions[old.approval_status]?.includes(target))return err("invalid_transition",409);
 if((target==="approved"||target==="published")&&!old.verified_information.trim())return err("verified_information_required",409);
 await env.DB.prepare("UPDATE product_ai_knowledge SET approval_status=?,approved_by=CASE WHEN ?='approved' THEN ? ELSE approved_by END,approved_at=CASE WHEN ?='approved' THEN CURRENT_TIMESTAMP ELSE approved_at END,published_at=CASE WHEN ?='published' THEN CURRENT_TIMESTAMP ELSE published_at END,updated_at=CURRENT_TIMESTAMP WHERE product_code=? AND approval_status=?").bind(target,target,actorId,target,target,key,old.approval_status).run();
 await audit("product_knowledge",key,"approval_transition",{status:old.approval_status},{status:target}).run();
 return json({product_code:key,approval_status:target});
 }
 if(kind==="comments"&&!key&&method==="GET"){
 const rows=await env.DB.prepare("SELECT id,page_id,post_id,comment_id,comment_text,product_codes_json,resolution_status,public_reply_status,private_reply_status,delivery_status,created_at FROM facebook_comment_events ORDER BY id DESC LIMIT 100").all();
 return json({comments:rows.results});
 }
 if(kind==="contents"&&!key&&method==="GET"){
 const rows=await env.DB.prepare("SELECT c.id,c.page_id,c.facebook_content_id,c.content_type,c.content_name,c.post_message,c.permalink,c.source,c.sync_status,c.status,COALESCE(GROUP_CONCAT(m.product_code), '') AS product_codes FROM facebook_contents c LEFT JOIN facebook_content_products m ON m.content_id=c.id GROUP BY c.id ORDER BY c.id DESC LIMIT 100").all();
 return json({contents:rows.results});
 }
 if(kind==="contents"&&!key&&method==="POST"){
 const b=await body(),page=String(b.page_id||"").trim(),id=String(b.facebook_content_id||"").trim(),type=b.content_type??"post";
 if(!/^[0-9]{3,40}$/.test(page)||!/^[0-9_]{3,100}$/.test(id)||!["post","ad","reel","video","photo"].includes(type)||!text(b.content_name??"",300)||!text(b.post_message??"",10000)||!text(b.permalink??"",2000))return err("invalid_content");
 const existing=await env.DB.prepare("SELECT id FROM facebook_contents WHERE page_id=? AND facebook_content_id=?").bind(page,id).first();
 if(existing)return err("content_exists",409);
 const result=await env.DB.prepare("INSERT INTO facebook_contents(page_id,facebook_content_id,content_type,content_name,post_message,permalink,source) VALUES(?,?,?,?,?,?,'manual')").bind(page,id,type,b.content_name??"",b.post_message??"",b.permalink??"").run();
 await audit("facebook_content",result.meta.last_row_id,"create",null,{page_id:page,facebook_content_id:id}).run();
 return json({created:true,id:result.meta.last_row_id},201);
 }
 if(kind==="contents"&&key&&sub==="products"&&method==="PUT"){
 const id=Number(key);if(!Number.isSafeInteger(id)||id<1)return err("invalid_content_id");
 const b=await body(),codes=b.product_codes;
 if(!Array.isArray(codes)||codes.length>30||new Set(codes).size!==codes.length||codes.some(x=>!code(x)))return err("invalid_product_codes");
 const content=await env.DB.prepare("SELECT id FROM facebook_contents WHERE id=?").bind(id).first();if(!content)return err("not_found",404);
 for(const product of codes){const exists=await env.DB.prepare("SELECT product_code FROM products WHERE product_code=?").bind(product).first();if(!exists)return err("unknown_product_"+product,409)}
 const old=await env.DB.prepare("SELECT product_code FROM facebook_content_products WHERE content_id=?").bind(id).all();
 // Atomic replacement: never leave partial mappings on failure.
 const statements=[env.DB.prepare("DELETE FROM facebook_content_products WHERE content_id=?").bind(id),...codes.map((product,i)=>env.DB.prepare("INSERT INTO facebook_content_products(content_id,product_code,is_primary) VALUES(?,?,?)").bind(id,product,i===0?1:0)),env.DB.prepare("UPDATE facebook_contents SET sync_status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(codes.length?"mapped":"unmapped",id)];
 await env.DB.batch(statements);
 await audit("facebook_content",id,"products_mapped",{product_codes:old.results.map(x=>x.product_code)},{product_codes:codes}).run();
 return json({mapped:true,id,product_codes:codes});
 }
 if(kind==="contents"&&key&&sub==="aliases"&&method==="POST"){
 const id=Number(key);if(!Number.isSafeInteger(id)||id<1)return err("invalid_content_id");
 const b=await body(),type=b.alias_type,alias=String(b.alias_id||"").trim();
 if(!["ad","creative","post","boosted_post"].includes(type)||!/^[0-9_]{3,100}$/.test(alias))return err("invalid_alias");
 const found=await env.DB.prepare("SELECT id FROM facebook_contents WHERE id=?").bind(id).first();if(!found)return err("not_found",404);
 const old=await env.DB.prepare("SELECT content_id FROM facebook_content_aliases WHERE alias_type=? AND alias_id=?").bind(type,alias).first();
 if(old&&old.content_id!==id)return err("alias_already_mapped_to_other_content",409);
 await env.DB.prepare("INSERT OR IGNORE INTO facebook_content_aliases(alias_type,alias_id,content_id) VALUES(?,?,?)").bind(type,alias,id).run();
 await audit("facebook_content",id,"alias_mapped",null,{alias_type:type,alias_id:alias}).run();
 return json({mapped:true,content_id:id,alias_type:type,alias_id:alias});
 }
 if(kind==="resolve"&&method==="GET"){
 const id=new URL(req.url).searchParams.get("content_id"),alias=new URL(req.url).searchParams.get("alias_type");
 if(!id||id.length>100)return err("invalid_content_id");
 const rows=await env.DB.prepare("SELECT c.facebook_content_id,c.content_type,m.product_code,p.product_name,p.sale_price,p.currency,k.approval_status FROM facebook_contents c LEFT JOIN facebook_content_aliases a ON a.content_id=c.id LEFT JOIN facebook_content_products m ON m.content_id=c.id LEFT JOIN products p ON p.product_code=m.product_code LEFT JOIN product_ai_knowledge k ON k.product_code=m.product_code WHERE (c.facebook_content_id=? OR (a.alias_id=? AND a.alias_type=?)) AND c.status='active' AND p.status='active'").bind(id,id,alias??"").all();
 return json({matches:rows.results,needs_clarification:rows.results.length!==1});
 }
 if(kind==="sync"&&method==="POST"){
 // No Page access token is installed by default. Fail closed instead of scraping or inventing posts.
 if(!env.FACEBOOK_PAGE_ACCESS_TOKEN||!env.FACEBOOK_PAGE_ID)return err("facebook_sync_not_configured",503);
 const page=String(env.FACEBOOK_PAGE_ID);if(!/^[0-9]{3,40}$/.test(page))return err("invalid_page_configuration",503);
 const url=new URL("https://graph.facebook.com/v23.0/"+page+"/posts");url.searchParams.set("fields","id,message,permalink_url,created_time");url.searchParams.set("limit","50");
 let imported=0,updated=0,auto_mapped=0,needs_review=0,pages=0,next=url.toString();
 while(next&&pages<10){
  const parsed=new URL(next);
  if(parsed.origin!=="https://graph.facebook.com")return err("unsafe_pagination_url",502);
  const response=await fetch(parsed.toString(),{headers:{authorization:"Bearer "+env.FACEBOOK_PAGE_ACCESS_TOKEN},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return err("facebook_sync_upstream_error",502);
  const result=await response.json();if(!Array.isArray(result.data))return err("invalid_facebook_response",502);
  const stats=await syncContent(env.DB,page,result.data);
  imported+=stats.created;updated+=stats.updated;auto_mapped+=stats.auto_mapped;needs_review+=stats.needs_review;
  next=result.paging?.next||null;pages++;
 }
 await audit("facebook_sync",page,"sync",null,{imported,updated}).run();
 return json({synced:true,imported,updated,auto_mapped,needs_review,pages,has_more:!!next});
 }
 return err("not_found",404);
 }catch(e){return err(e instanceof SyntaxError||e.message==="invalid_json"?"invalid_json":"intelligence_request_failed",e instanceof SyntaxError||e.message==="invalid_json"?400:500)}
}
