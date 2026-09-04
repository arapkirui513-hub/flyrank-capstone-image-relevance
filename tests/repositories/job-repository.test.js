import assert from "node:assert/strict";
import test, { after } from "node:test";

import { pool } from "../../app/db/pool.js";
import {
  createJob,
  findJobById,
  findJobs,
  updateJobStatus,
  updateJobProgress,
  incrementJobAttempts,
  setJobError,
  deleteJob
} from "../../app/repositories/job-repository.js";

test("job repository persists, retrieves, updates lifecycle, tracks progress, and deletes jobs", async () => {
  const created = await createJob({
    jobType: "image_processing",
    totalItems: 10
  });

  assert.ok(created.id);
  assert.equal(created.job_type, "image_processing");
  assert.equal(created.status, "pending");
  assert.equal(created.total_items, 10);
  assert.equal(created.processed_items, 0);
  assert.equal(created.failed_items, 0);
  assert.equal(created.attempts, 0);
  assert.equal(created.error_message, null);
  assert.equal(created.started_at, null);
  assert.equal(created.completed_at, null);

  const found = await findJobById(created.id);

  assert.ok(found);
  assert.equal(found.id, created.id);
  assert.equal(found.job_type, "image_processing");

  const pendingJobs = await findJobs({
    status: "pending"
  });

  assert.ok(
    pendingJobs.some((job) => job.id === created.id)
  );

  const running = await updateJobStatus(
    created.id,
    "running"
  );

  assert.ok(running);
  assert.equal(running.status, "running");
  assert.ok(running.started_at);
  assert.equal(running.completed_at, null);

  const progressed = await updateJobProgress(
    created.id,
    {
      processedItems: 7,
      failedItems: 1
    }
  );

  assert.ok(progressed);
  assert.equal(progressed.processed_items, 7);
  assert.equal(progressed.failed_items, 1);

  const attempted = await incrementJobAttempts(
    created.id
  );

  assert.ok(attempted);
  assert.equal(attempted.attempts, 1);

  const completed = await updateJobStatus(
    created.id,
    "completed"
  );

  assert.ok(completed);
  assert.equal(completed.status, "completed");
  assert.ok(completed.started_at);
  assert.ok(completed.completed_at);

  const deleted = await deleteJob(created.id);

  assert.ok(deleted);
  assert.equal(deleted.id, created.id);

  const afterDelete = await findJobById(created.id);

  assert.equal(afterDelete, null);
});

test("job repository records failure state and error message", async () => {
  const created = await createJob({
    jobType: "image_embedding",
    totalItems: 5
  });

  const failed = await setJobError(
    created.id,
    "Embedding provider unavailable"
  );

  assert.ok(failed);
  assert.equal(failed.status, "failed");
  assert.equal(
    failed.error_message,
    "Embedding provider unavailable"
  );
  assert.ok(failed.completed_at);

  await deleteJob(created.id);
});

after(async () => {
  await pool.end();
});