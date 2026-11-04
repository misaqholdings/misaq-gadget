import test from "node:test";
import assert from "node:assert/strict";
import {phase07CommentReview} from "../workers/phase07-comment-review-api.mjs";
const req=new Request("https://staging.example/api/v1/intelligence/comments/review?id=1");
test("staging guard blocks non-staging",async()=>{const r=await phase07CommentReview(req,{STAGING_MODE:"production"},"admin",true);assert.equal(r.status,403)});
test("staff auth required",async()=>{const r=await phase07CommentReview(req,{STAGING_MODE:"isolated-test"},"integration",false);assert.equal(r.status,403)});
test("invalid ids rejected",async()=>{const r=await phase07CommentReview(new Request("https://staging.example/?id=x"),{STAGING_MODE:"isolated-test"},"admin",true);assert.equal(r.status,400)});
