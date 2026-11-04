// Phase 07: admin-only staging product catalog API. Requires the host Worker's staffAuth role.
async function phase07Catalog(req,env,ctx,p,role,staff,actorId){
 const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
 if(role!=="admin"||!staff)return respond({error:"admin_staff_required"},403);
 const method=req.method,parts=p.split("/").filter(Boolean),kind=parts[3],key=parts[4],sub=parts[5];
 if(!["products","variants"].includes(kind))return respond({error:"not_found"},404);
 const fail=(code,status=400)=>respond({error:code},status);
 const body=async()=>{const v=await req.json();if(!v||typeof v!=="object"||Array.isArray(v))throw Error("invalid_json");return v};
 const code=v=>typeof v==="string"&&/^[A-Z0-9_-]{3,64}$/.test(v);
 const name=v=>typeof v==="string"&&v.trim().length>=3&&v.trim().length<=160;
 const money=v=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=10000000;
 const status=v=>v==="active"||v==="inactive";
 const audit=(entity,id,action,oldV,newV)=>env.DB.prepare("INSERT INTO audit_logs(entity_type,entity_id,action,actor_type,actor_id,old_values_json,new_values_json) VALUES(?,?,?,'admin',?,?,?)").bind(entity,String(id),action,actorId,JSON.stringify(oldV),JSON.stringify(newV));
 try{
 if(kind==="products"&&!key&&method==="GET"){
 const rows=await env.DB.prepare("SELECT p.id,p.product_code,p.product_name,p.sale_price,p.regular_price,p.currency,p.status,p.image_url,p.product_url,(SELECT COUNT(*) FROM product_variants v WHERE v.product_id=p.id) AS variant_count FROM products p ORDER BY p.id DESC LIMIT 100").all();
 return respond({products:rows.results});
 }
 if(kind==="products"&&!key&&method==="POST"){
 const b=await body(),product_code=String(b.product_code||"").trim().toUpperCase();
 if(!code(product_code)||!name(b.product_name)||!money(b.sale_price)||!status(b.status??"inactive"))return fail("invalid_product");
 const v={product_code,product_name:b.product_name.trim(),sale_price:b.sale_price,status:b.status??"inactive"};
 const exists=await env.DB.prepare("SELECT id FROM products WHERE product_code=?").bind(product_code).first();if(exists)return fail("product_exists",409);
 const r=await env.DB.prepare("INSERT INTO products(product_code,product_name,sale_price,status,currency) VALUES(?,?,?,?,'BDT')").bind(v.product_code,v.product_name,v.sale_price,v.status).run();
 await audit("product",r.meta.last_row_id,"create",null,v).run();return respond({created:true,id:r.meta.last_row_id,...v},201);
 }
 if(kind==="products"&&key&&!sub&&method==="PATCH"){
 if(!code(key))return fail("invalid_product_code");const old=await env.DB.prepare("SELECT id,product_code,product_name,sale_price,status FROM products WHERE product_code=?").bind(key).first();if(!old)return fail("not_found",404);
 const b=await body();const allowed=["product_name","sale_price","status"];if(!Object.keys(b).length||Object.keys(b).some(x=>!allowed.includes(x)))return fail("invalid_fields");
 const next={product_name:b.product_name??old.product_name,sale_price:b.sale_price??old.sale_price,status:b.status??old.status};
 if(!name(next.product_name)||!money(next.sale_price)||!status(next.status))return fail("invalid_product");
 const result=await env.DB.prepare("UPDATE products SET product_name=?,sale_price=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND product_name=? AND sale_price=? AND status=?").bind(next.product_name.trim(),next.sale_price,next.status,old.id,old.product_name,old.sale_price,old.status).run();
 if(result.meta.changes!==1)return fail("concurrent_update",409);
 await audit("product",old.id,"update",old,next).run();return respond({updated:true,product_code:key,...next});
 }
 if(kind==="products"&&key&&sub==="variants"&&method==="GET"){
 if(!code(key))return fail("invalid_product_code");
 const rows=await env.DB.prepare("SELECT v.id,v.sku,v.variant_name,v.attributes_json,v.price_override,v.stock_quantity,v.status FROM product_variants v JOIN products p ON p.id=v.product_id WHERE p.product_code=? ORDER BY v.id DESC").bind(key).all();
 return respond({variants:rows.results});
 }
 if(kind==="products"&&key&&sub==="variants"&&method==="POST"){
 if(!code(key))return fail("invalid_product_code");const product=await env.DB.prepare("SELECT id FROM products WHERE product_code=?").bind(key).first();if(!product)return fail("not_found",404);
 const b=await body(),sku=String(b.sku||"").trim().toUpperCase(),attrs=b.attributes??{},stock=b.stock_quantity??0,price=b.price_override??null;
 if(!/^[A-Z0-9_-]{3,80}$/.test(sku)||!name(b.variant_name)||!Number.isSafeInteger(stock)||stock<0||price!==null&&!money(price)||!status(b.status??"inactive")||!attrs||typeof attrs!=="object"||Array.isArray(attrs)||JSON.stringify(attrs).length>2000)return fail("invalid_variant");
 const exists=await env.DB.prepare("SELECT id FROM product_variants WHERE sku=?").bind(sku).first();if(exists)return fail("sku_exists",409);
 const v={sku,variant_name:b.variant_name.trim(),attributes_json:JSON.stringify(attrs),price_override:price,stock_quantity:stock,status:b.status??"inactive"};
 const r=await env.DB.prepare("INSERT INTO product_variants(product_id,sku,variant_name,attributes_json,price_override,stock_quantity,status) VALUES(?,?,?,?,?,?,?)").bind(product.id,v.sku,v.variant_name,v.attributes_json,v.price_override,v.stock_quantity,v.status).run();
 await audit("product_variant",r.meta.last_row_id,"create",null,v).run();return respond({created:true,id:r.meta.last_row_id,...v},201);
 }
 if(kind==="variants"&&key&&method==="PATCH"){
 const id=Number(key);if(!Number.isSafeInteger(id)||id<1)return fail("invalid_variant_id");
 const old=await env.DB.prepare("SELECT id,sku,variant_name,price_override,stock_quantity,status FROM product_variants WHERE id=?").bind(id).first();if(!old)return fail("not_found",404);
 const b=await body();if(!Object.keys(b).length||Object.keys(b).some(x=>!["variant_name","price_override","status"].includes(x)))return fail("invalid_fields");
 const next={variant_name:b.variant_name??old.variant_name,price_override:b.price_override===undefined?old.price_override:b.price_override,status:b.status??old.status};
 if(!name(next.variant_name)||next.price_override!==null&&!money(next.price_override)||!status(next.status))return fail("invalid_variant");
 await env.DB.prepare("UPDATE product_variants SET variant_name=?,price_override=?,status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(next.variant_name.trim(),next.price_override,next.status,id).run();
 await audit("product_variant",id,"update",old,next).run();return respond({updated:true,id,...next});
 }
 if(kind==="variants"&&key&&sub==="stock"&&method==="POST"){
 const id=Number(key);if(!Number.isSafeInteger(id)||id<1)return fail("invalid_variant_id");
 const b=await body(),delta=b.quantity_delta,reason=b.reason;
 if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>100000||typeof reason!=="string"||reason.trim().length<5||reason.length>200)return fail("invalid_stock_movement");
 const old=await env.DB.prepare("SELECT stock_quantity FROM product_variants WHERE id=?").bind(id).first();if(!old)return fail("not_found",404);
 const r=await env.DB.prepare("UPDATE product_variants SET stock_quantity=stock_quantity+?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND stock_quantity=? AND stock_quantity+?>=0").bind(delta,id,old.stock_quantity,delta).run();
 if(r.meta.changes!==1)return fail("stock_conflict_or_insufficient",409);
 await env.DB.prepare("INSERT INTO product_inventory_movements(variant_id,quantity_delta,reason,actor_id) VALUES(?,?,?,?)").bind(id,delta,reason.trim(),actorId).run();
 await audit("product_variant",id,"stock_adjustment",{stock_quantity:old.stock_quantity},{stock_quantity:old.stock_quantity+delta,reason:reason.trim()}).run();
 return respond({updated:true,id,stock_quantity:old.stock_quantity+delta});
 }
 return fail("not_found",404);
 }catch(e){return fail(e instanceof SyntaxError?"invalid_json":"catalog_request_failed",e instanceof SyntaxError?400:500)}
}
