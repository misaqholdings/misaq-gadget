// Phase 07 staging-only comment decision engine. No Meta API calls, no message sends.
// Caller must verify webhook signature and persist/deduplicate event before invoking.
export function decideCommentReply({event, mappedProductCodes, publishedKnowledge}) {
  const codes=[...new Set((mappedProductCodes||[]).filter(Boolean))];
  if (!event || !event.comment_id || !event.post_id) return {action:"ignore",reason:"invalid_event"};
  if (event.is_page_author) return {action:"ignore",reason:"page_authored"};
  if (codes.length===0) return {action:"human_review",reason:"unmapped_post"};
  if (codes.length>1) return {action:"clarify",reason:"multiple_products",product_codes:codes};
  const code=codes[0], k=publishedKnowledge;
  if (!k || k.product_code!==code || k.approval_status!=="published")
    return {action:"human_review",reason:"knowledge_not_published",product_code:code};
  const message=String(event.comment_text||"").trim();
  if (!message) return {action:"human_review",reason:"empty_comment",product_code:code};
  // Escalate issues requiring order-specific checks, evidence or unverified terms.
  if (/অর্ডার|রিটার্ন|রিপ্লেস|নষ্ট|খারাপ|ডিফেক্ট|ওয়ারেন্টি ক্লেইম|ওয়ারেন্টি ক্লেইম|refund|return|replace|broken|defect|order status|tracking|complaint/i.test(message))
    return {action:"human_review",reason:"case_specific",product_code:code};
  const fields={};
  if (/দাম|মূল্য|কত টাকা|price|cost/i.test(message)) {
    if (Number.isFinite(Number(k.sale_price)) && Number(k.sale_price)>0 && k.currency==="BDT")
      fields.price="দাম ৳"+Number(k.sale_price).toLocaleString("en-US")+"।";
    else return {action:"human_review",reason:"price_unverified",product_code:code};
  }
  if (/ডেলিভারি|delivery|shipping|ঢাকা|dhaka/i.test(message)) {
    if (!k.delivery_policy) return {action:"human_review",reason:"delivery_unverified",product_code:code};
    // Do not convert free-text policy into fabricated promise; human-reviewed answer required.
    return {action:"human_review",reason:"delivery_needs_context",product_code:code};
  }
  if (/ওয়ারেন্টি|ওয়ারেন্টি|warranty/i.test(message)) {
    if (!k.warranty_policy) return {action:"human_review",reason:"warranty_unverified",product_code:code};
    return {action:"human_review",reason:"warranty_needs_context",product_code:code};
  }
  if (/cod|ক্যাশ অন ডেলিভারি|পেমেন্ট|payment/i.test(message)) {
    if (k.payment_methods?.includes("Cash on Delivery")) fields.payment="ক্যাশ অন ডেলিভারি (COD) সুবিধা রয়েছে।";
    else return {action:"human_review",reason:"payment_unverified",product_code:code};
  }
  if (!Object.keys(fields).length) return {action:"human_review",reason:"unrecognized_intent",product_code:code};
  return {action:"draft_reply",reason:"verified_fact",product_code:code,text:Object.values(fields).join(" ")+(k.product_url ? " বিস্তারিত: "+k.product_url : ""),requires_human_approval:true};
}
