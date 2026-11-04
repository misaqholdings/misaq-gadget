// Phase 06 staging-only Meta test dispatcher (explicit allowlist, no automatic production dispatch).
// Call with D1 binding, fetch implementation and Meta test credentials from a trusted staging Worker.
export async function dispatchSelectedTestEvents({db, fetchImpl=fetch, pixelId, accessToken, testEventCode, ids=[14,15]}) {
  if (!db || !pixelId || !accessToken || !testEventCode) throw Error("missing_staging_configuration");
  if (ids.length !== 2 || ids[0] !== 14 || ids[1] !== 15) throw Error("unexpected_outbox_ids");
  const results = [];
  for (const id of ids) {
    const row = await db.prepare("SELECT o.id,o.event_id,o.event_name,o.status,o.attempt_count,o.payload_json,r.order_id,r.order_status FROM meta_event_outbox o JOIN orders r ON r.id=o.order_id WHERE o.id=?").bind(id).first();
    if (!row || row.order_id !== "qa_p06_43795709afb84a958c9cdd72" || row.order_status !== "delivered" ||
      row.event_name !== (id===14?"Lead":"Purchase") || row.event_id !== "staging:qa_p06_43795709afb84a958c9cdd72:"+(id===14?"Lead":"Purchase"))
      throw Error("outbox_allowlist_mismatch");
    if (row.status !== "pending" || row.attempt_count !== 0) { results.push({id,status:"skipped_not_pending"});continue; }
    const data=JSON.parse(row.payload_json);
    if (data.test_mode !== 1 || data.dispatch_enabled !== 0) throw Error("unsafe_outbox_flags");
    const claim=await db.prepare("UPDATE meta_event_outbox SET status='processing',attempt_count=attempt_count+1,last_attempt_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='pending' AND attempt_count=0").bind(id).run();
    if (claim.meta.changes!==1) {results.push({id,status:"not_claimed"});continue;}
    // Intentionally omit all personal identifiers and matching data in synthetic tests.
    const event={event_name:row.event_name,event_id:row.event_id,event_time:Math.floor(Date.now()/1000),action_source:"website",event_source_url:"https://gadget.misaqholdings.com/q86-earbuds/",user_data:{external_id:[await syntheticHash(row.event_id)]},custom_data:data.custom_data};
    try {
      const response=await fetchImpl("https://graph.facebook.com/v23.0/"+encodeURIComponent(pixelId)+"/events",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer "+accessToken},body:JSON.stringify({data:[event],test_event_code:testEventCode}),signal:AbortSignal.timeout(12000)});
      const result=await response.json().catch(()=>({}));
      const sent=response.ok&&result.events_received===1;
      // Ambiguous errors are quarantined for manual review, never automatically retried.
      const status=sent?"sent":response.status>=500||response.status===429?"unknown":"rejected";
      await db.prepare("UPDATE meta_event_outbox SET status=?,sent_at=CASE WHEN ?='sent' THEN CURRENT_TIMESTAMP ELSE NULL END,last_error_code=?,last_error_message=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'").bind(status,status,sent?null:"http_"+response.status,sent?null:"Meta response requires review",id).run();
      results.push({id,status,http_status:response.status,events_received:result.events_received??null});
    }catch(_){
      await db.prepare("UPDATE meta_event_outbox SET status='unknown',last_error_code='ambiguous_network_failure',last_error_message='Manual review required; no automatic retry',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='processing'").bind(id).run();
      results.push({id,status:"unknown"});
    }
  }
  return results;
}
async function syntheticHash(eventId){
  const bytes=new TextEncoder().encode("misaq-staging-synthetic-only:"+eventId);
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
