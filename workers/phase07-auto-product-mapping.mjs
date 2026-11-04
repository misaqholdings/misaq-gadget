// Phase 07 automatic content-to-existing-product matching.
// Conservative deterministic identification; never creates products or overwrites admin mapping.
export function identifyProducts(post, products) {
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
export async function syncContent(db,pageId,posts) {
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
