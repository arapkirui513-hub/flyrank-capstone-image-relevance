import assert from "node:assert/strict";
import test from "node:test";

import { ImageProcessingJobService } from "../../app/services/image-processing-job-service.js";

function createDependencies({
  images = [
    { id: "image-1" },
    { id: "image-2" }
  ],
  processImage = async () => {},
  maxAttempts = 3
} = {}) {
  const calls = {
    createdJobs: [],
    statuses: [],
    progress: [],
    attempts: [],
    processedImages: [],
    errors: []
  };

  const jobRepository = {
    async createJob(input) {
      calls.createdJobs.push(input);

      return {
        id: "job-1",
        ...input,
        status: "pending"
      };
    },

    async updateJobStatus(id, status) {
      calls.statuses.push({ id, status });

      return {
        id,
        status
      };
    },

    async updateJobProgress(id, progress) {
      calls.progress.push({ id, ...progress });

      return {
        id,
        ...progress
      };
    },

    async incrementJobAttempts(id) {
      calls.attempts.push(id);

      return {
        id,
        attempts: calls.attempts.length
      };
    },

    async setJobError(id, errorMessage) {
      calls.errors.push({ id, errorMessage });

      return {
        id,
        status: "failed",
        error_message: errorMessage
      };
    }
  };

  const imageRepository = {
    async findImages() {
      return images;
    }
  };

  const imageProcessingService = {
    async processImage(imageId, options) {
      calls.processedImages.push({
        imageId,
        ...options
      });

      return processImage(imageId, options);
    }
  };

  const service = new ImageProcessingJobService({
    jobRepository,
    imageRepository,
    imageProcessingService,
    maxAttempts
  });

  return {
    service,
    calls
  };
}

test("creates an image processing job from pending images", async () => {
  const { service, calls } = createDependencies();

  const job = await service.createImageProcessingJob();

  assert.equal(job.id, "job-1");
  assert.deepEqual(calls.createdJobs, [
    {
      jobType: "image_processing",
      totalItems: 2
    }
  ]);

  await new Promise((resolve) => setImmediate(resolve));

  assert.deepEqual(calls.statuses, [
    {
      id: "job-1",
      status: "running"
    },
    {
      id: "job-1",
      status: "completed"
    }
  ]);
});

test("processes every image, tracks progress, and passes job id to image processing", async () => {
  const { service, calls } = createDependencies();

  await service.runJob("job-1", [
    { id: "image-1" },
    { id: "image-2" }
  ]);

  assert.deepEqual(calls.processedImages, [
    {
      imageId: "image-1",
      jobId: "job-1"
    },
    {
      imageId: "image-2",
      jobId: "job-1"
    }
  ]);

  assert.deepEqual(calls.progress, [
    {
      id: "job-1",
      processedItems: 1,
      failedItems: 0
    },
    {
      id: "job-1",
      processedItems: 2,
      failedItems: 0
    }
  ]);

  assert.equal(calls.attempts.length, 2);
});

test("retries failed image processing and succeeds", async () => {
  let attempts = 0;

  const { service, calls } = createDependencies({
    images: [{ id: "image-1" }],
    processImage: async () => {
      attempts += 1;

      if (attempts < 3) {
        throw new Error("temporary provider failure");
      }
    }
  });

  await service.runJob("job-1", [
    { id: "image-1" }
  ]);

  assert.equal(attempts, 3);
  assert.equal(calls.attempts.length, 3);

  assert.deepEqual(calls.progress, [
    {
      id: "job-1",
      processedItems: 1,
      failedItems: 0
    }
  ]);

  assert.deepEqual(calls.statuses, [
    {
      id: "job-1",
      status: "running"
    },
    {
      id: "job-1",
      status: "completed"
    }
  ]);
});

test("marks an image as failed after retry limit is exhausted", async () => {
  const { service, calls } = createDependencies({
    images: [{ id: "image-1" }],
    processImage: async () => {
      throw new Error("provider unavailable");
    },
    maxAttempts: 3
  });

  await service.runJob("job-1", [
    { id: "image-1" }
  ]);

  assert.equal(calls.attempts.length, 3);

  assert.deepEqual(calls.progress, [
    {
      id: "job-1",
      processedItems: 0,
      failedItems: 1
    }
  ]);

  assert.deepEqual(calls.statuses, [
    {
      id: "job-1",
      status: "running"
    }
  ]);

  assert.deepEqual(calls.errors, [
    {
      id: "job-1",
      errorMessage: "1 image(s) failed after retries."
    }
  ]);
});

test("marks the job failed when job execution itself fails", async () => {
  const { service, calls } = createDependencies();

  const originalUpdateJobStatus =
    service.jobRepository.updateJobStatus;

  service.jobRepository.updateJobStatus = async () => {
    throw new Error("database unavailable");
  };

  await service.runJob("job-1", []);

  assert.deepEqual(calls.errors, [
    {
      id: "job-1",
      errorMessage: "database unavailable"
    }
  ]);

  service.jobRepository.updateJobStatus =
    originalUpdateJobStatus;
});
