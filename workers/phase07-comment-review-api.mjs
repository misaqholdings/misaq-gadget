// Staging-only comment review API. Host must authenticate role/staff before invoking.
// Produces drafts; NEVER sends public or private Meta replies.
import {decideCommentReply} from "./phase07-comment-intelligence.mjs";
export async function phase07CommentReview(req,env,role,staff) {
 const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
 if(env.STAGING_MODE!=="isolated-test")return respond({error:"staging_only"},403);
 if(role!=="admin"||!staff)return respond({error:"admin_staff_required"},403);
 if(req.method!=="GET")return respond({error:"method_not_allowed"},405);
 const id=Number(new URL(req.url).searchParams.get("id"));
 if(!Number.isSafeInteger(id)||id<1)return respond({error:"invalid_id"},400);
 const event=await env.DB.prepare("SELECT * FROM facebook_comment_events WHERE id=?").bind(id).first();
 if(!event)return respond({error:"not_found"},404);
 let codes;
 try{codes=JSON.parse(event.product_codes_json);if(!Array.isArray(codes))throw Error("invalid");}
 catch{return respond({error:"invalid_product_mapping"},409)}
 if(codes.length!==1)return respond({decision:decideCommentReply({event,mappedProductCodes:codes,publishedKnowledge:null})});
 const k=await env.DB.prepare("SELECT p.product_code,p.sale_price,p.currency,p.product_url,k.approval_status,k.payment_methods,k.delivery_policy,k.warranty_policy FROM products p JOIN product_ai_knowledge k ON k.product_code=p.product_code WHERE p.product_code=? AND p.status='active' AND k.approval_status='published'").bind(codes[0]).first();
 const decision=decideCommentReply({event,mappedProductCodes:codes,publishedKnowledge:k});
 return respond({id,decision,public_reply_status:event.public_reply_status,private_reply_status:event.private_reply_status,delivery_status:event.delivery_status});
}
