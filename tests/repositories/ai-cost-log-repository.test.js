import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createAiCostLog,
  findAiCostLogById,
  findAiCostLogs,
  deleteAiCostLog
} from "../../app/repositories/ai-cost-log-repository.js";
import { createJob, deleteJob } from "../../app/repositories/job-repository.js";

test("AI cost log repository persists, retrieves, filters, and deletes successful operations", async () => {
  const job = await createJob({
    jobType: "image_processing",
    totalItems: 3
  });

  const created = await createAiCostLog({
    jobId: job.id,
    operation: "image_embedding",
    provider: "openai",
    model: "text-embedding-test",
    inputTokens: 120,
    outputTokens: 0,
    durationMs: 850,
    estimatedCostUsd: 0.00125,
    success: true
  });

  assert.ok(created.id);
  assert.equal(created.job_id, job.id);
  assert.equal(created.operation, "image_embedding");
  assert.equal(created.provider, "openai");
  assert.equal(created.model, "text-embedding-test");
  assert.equal(created.input_tokens, 120);
  assert.equal(created.output_tokens, 0);
  assert.equal(created.duration_ms, 850);
  assert.equal(created.estimated_cost_usd, "0.00125000");
  assert.equal(created.success, true);
  assert.equal(created.error_message, null);

  const found = await findAiCostLogById(created.id);

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.job_id, job.id);
  assert.equal(found.operation, "image_embedding");

  const jobLogs = await findAiCostLogs({
    jobId: job.id
  });

  assert.ok(
    jobLogs.some((log) => log.id === created.id)
  );

  const deleted = await deleteAiCostLog(created.id);

  assert.ok(deleted);
  assert.equal(deleted.id, created.id);

  const afterDelete = await findAiCostLogById(created.id);

  assert.equal(afterDelete, null);

  await deleteJob(job.id);
});

test("AI cost log repository records failed operations with nullable usage and cost", async () => {
  const created = await createAiCostLog({
    operation: "vision_analysis",
    provider: "openai",
    model: "vision-test",
    durationMs: 1500,
    success: false,
    errorMessage: "Provider request failed"
  });

  assert.ok(created.id);
  assert.equal(created.job_id, null);
  assert.equal(created.input_tokens, null);
  assert.equal(created.output_tokens, null);
  assert.equal(created.estimated_cost_usd, null);
  assert.equal(created.success, false);
  assert.equal(
    created.error_message,
    "Provider request failed"
  );

  const found = await findAiCostLogById(created.id);

  assert.ok(found);
  assert.equal(found.success, false);
  assert.equal(
    found.error_message,
    "Provider request failed"
  );

  await deleteAiCostLog(created.id);
});

test("deleting a job sets its AI cost log job reference to null", async () => {
  const job = await createJob({
    jobType: "image_captioning",
    totalItems: 1
  });

  const created = await createAiCostLog({
    jobId: job.id,
    operation: "caption_generation",
    provider: "openai",
    model: "vision-test",
    durationMs: 500,
    success: true
  });

  await deleteJob(job.id);

  const afterJobDelete = await findAiCostLogById(
    created.id
  );

  assert.ok(afterJobDelete);
  assert.equal(afterJobDelete.job_id, null);

  await deleteAiCostLog(created.id);
});

after(async () => {
  await pool.end();
});