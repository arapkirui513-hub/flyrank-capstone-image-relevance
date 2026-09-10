const DEFAULT_MAX_ATTEMPTS = 3;

export class ImageProcessingJobService {
  constructor({
    jobRepository,
    imageRepository,
    imageProcessingService,
    maxAttempts = DEFAULT_MAX_ATTEMPTS
  }) {
    this.jobRepository = jobRepository;
    this.imageRepository = imageRepository;
    this.imageProcessingService = imageProcessingService;
    this.maxAttempts = maxAttempts;
  }

  async createImageProcessingJob() {
    const images = await this.imageRepository.findImages({
      status: "pending",
      limit: 100,
      offset: 0
    });

    const job = await this.jobRepository.createJob({
      jobType: "image_processing",
      totalItems: images.length
    });

    void this.runJob(job.id, images);

    return job;
  }

  async runJob(jobId, images) {
    try {
      await this.jobRepository.updateJobStatus(
        jobId,
        "running"
      );

      let processedItems = 0;
      let failedItems = 0;

      for (const image of images) {
        let succeeded = false;
        let lastError = null;

        for (
          let attempt = 1;
          attempt <= this.maxAttempts;
          attempt += 1
        ) {
          await this.jobRepository.incrementJobAttempts(
            jobId
          );

          try {
            await this.imageProcessingService.processImage(
              image.id,
              { jobId }
            );

            succeeded = true;
            break;
          } catch (error) {
            lastError = error;
          }
        }

        if (succeeded) {
          processedItems += 1;
        } else {
          failedItems += 1;

          if (lastError) {
            console.error(
              `Image processing failed after ${this.maxAttempts} attempts: ${image.id}`,
              lastError
            );
          }
        }

        await this.jobRepository.updateJobProgress(
          jobId,
          {
            processedItems,
            failedItems
          }
        );
      }

      if (failedItems > 0) {
        return this.jobRepository.setJobError(
          jobId,
          `${failedItems} image(s) failed after retries.`
        );
      }

      return this.jobRepository.updateJobStatus(
        jobId,
        "completed"
      );
    } catch (error) {
      console.error(
        `Image processing job failed: ${jobId}`,
        error
      );

      return this.jobRepository.setJobError(
        jobId,
        error.message
      );
    }
  }
}
