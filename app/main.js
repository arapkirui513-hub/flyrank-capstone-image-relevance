import express from "express";

import {
  imageProcessingJobService,
  postRepository,
  postEmbeddingService,
  suggestionGenerationService
} from "./container.js";

import {
  createImage,
  findImageById,
  findImages
} from "./repositories/image-repository.js";

import {
  findSuggestionById,
  findImagesByPostId
} from "./repositories/suggestion-repository.js";

import {
  createReview,
  findReviewBySuggestionId
} from "./repositories/review-repository.js";

import {
  findJobById,
  findJobs
} from "./repositories/job-repository.js";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "flyrank-capstone-image-relevance"
  });
});

app.post("/jobs/image-processing", async (_req, res) => {
  try {
    const job =
      await imageProcessingJobService.createImageProcessingJob();

    return res.status(202).json({
      job
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to start image processing job."
    });
  }
});

app.get("/jobs/:id", async (req, res) => {
  try {
    const job =
      await findJobById(req.params.id);

    if (!job) {
      return res.status(404).json({
        error: "Job not found."
      });
    }

    return res.json(job);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve job."
    });
  }
});

app.get("/jobs", async (req, res) => {
  try {
    const limit = req.query.limit === undefined
      ? 50
      : Number(req.query.limit);

    const offset = req.query.offset === undefined
      ? 0
      : Number(req.query.offset);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: "limit must be an integer between 1 and 100."
      });
    }

    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({
        error: "offset must be a non-negative integer."
      });
    }

    const jobs = await findJobs({
      status: req.query.status,
      limit,
      offset
    });

    return res.json({
      jobs,
      limit,
      offset
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve jobs."
    });
  }
});

app.post("/images", async (req, res) => {
  try {
    const { filename, category } = req.body;

    if (typeof filename !== "string" || filename.trim().length === 0) {
      return res.status(400).json({
        error: "filename is required."
      });
    }

    if (typeof category !== "string" || category.trim().length === 0) {
      return res.status(400).json({
        error: "category is required."
      });
    }

    const image = await createImage({
      filename: filename.trim(),
      category: category.trim()
    });

    return res.status(201).json(image);
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "An image with that filename already exists."
      });
    }

    return res.status(500).json({
      error: "Failed to create image."
    });
  }
});

app.get("/posts/:id", async (req, res) => {
  try {
    const post = await postRepository.findPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        error: "Post not found."
      });
    }

    return res.json(post);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve post."
    });
  }
});

app.get("/posts/:id/images", async (req, res) => {
  try {
    const post = await postRepository.findPostById(req.params.id);

    if (!post) {
      return res.status(404).json({
        error: "Post not found."
      });
    }

    const limit = req.query.limit === undefined
      ? 50
      : Number(req.query.limit);

    const offset = req.query.offset === undefined
      ? 0
      : Number(req.query.offset);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: "limit must be an integer between 1 and 100."
      });
    }

    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({
        error: "offset must be a non-negative integer."
      });
    }

    const images = await findImagesByPostId(req.params.id, {
      limit,
      offset
    });

    return res.json({
      postId: req.params.id,
      images,
      limit,
      offset
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve images for post."
    });
  }
});

app.get("/images", async (req, res) => {
  try {
    const { category, status } = req.query;

    const limit = req.query.limit === undefined
      ? 50
      : Number(req.query.limit);

    const offset = req.query.offset === undefined
      ? 0
      : Number(req.query.offset);

    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        error: "limit must be an integer between 1 and 100."
      });
    }

    if (!Number.isInteger(offset) || offset < 0) {
      return res.status(400).json({
        error: "offset must be a non-negative integer."
      });
    }

    if (category !== undefined && category.trim().length === 0) {
      return res.status(400).json({
        error: "category cannot be empty."
      });
    }

    if (status !== undefined && status.trim().length === 0) {
      return res.status(400).json({
        error: "status cannot be empty."
      });
    }

    const images = await findImages({
      category: category?.trim(),
      status: status?.trim(),
      limit,
      offset
    });

    return res.json({
      images,
      limit,
      offset
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve images."
    });
  }
});

app.get("/images/:id", async (req, res) => {
  try {
    const image = await findImageById(req.params.id);

    if (!image) {
      return res.status(404).json({
        error: "Image not found."
      });
    }

    return res.json(image);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve image."
    });
  }
});

app.post("/posts", async (req, res) => {
  try {
    const { title, content } = req.body;

    if (
      typeof title !== "string" ||
      title.trim().length === 0
    ) {
      return res.status(400).json({
        error: "title is required."
      });
    }

    if (
      typeof content !== "string" ||
      content.trim().length === 0
    ) {
      return res.status(400).json({
        error: "content is required."
      });
    }

    const post = await postRepository.createPost({
      title: title.trim(),
      content: content.trim()
    });

    return res.status(201).json(post);
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to create post."
    });
  }
});

app.post("/posts/:postId/embed", async (req, res) => {
  try {
    const result =
      await postEmbeddingService.embedPost(
        req.params.postId
      );

    return res.status(201).json(result);
  } catch (error) {
    console.error(error);

    if (
      error.message?.startsWith("Post not found:")
    ) {
      return res.status(404).json({
        error: error.message
      });
    }

    return res.status(500).json({
      error: "Failed to generate post embedding."
    });
  }
});

app.post("/posts/:postId/suggestions", async (req, res) => {
  try {
    const {
      expectedSubject,
      limit = 10
    } = req.body;

    if (
      typeof expectedSubject !== "string" ||
      expectedSubject.trim().length === 0
    ) {
      return res.status(400).json({
        error: "expectedSubject is required."
      });
    }

    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 100
    ) {
      return res.status(400).json({
        error: "limit must be an integer between 1 and 100."
      });
    }

    const results =
      await suggestionGenerationService.generateForPost(
        req.params.postId,
        {
          expectedSubject: expectedSubject.trim(),
          limit
        }
      );

    return res.json({
      postId: req.params.postId,
      expectedSubject: expectedSubject.trim(),
      results
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to generate suggestions."
    });
  }
});

app.get("/suggestions/:id", async (req, res) => {
  try {
    const suggestion =
      await findSuggestionById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({
        error: "Suggestion not found."
      });
    }

    const review =
      await findReviewBySuggestionId(req.params.id);

    return res.json({
      suggestion,
      review
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to retrieve suggestion."
    });
  }
});

app.post("/suggestions/:id/approve", async (req, res) => {
  try {
    const suggestion =
      await findSuggestionById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({
        error: "Suggestion not found."
      });
    }

    const existingReview =
      await findReviewBySuggestionId(req.params.id);

    if (existingReview) {
      return res.status(409).json({
        error: "Suggestion has already been reviewed.",
        review: existingReview
      });
    }

    const review = await createReview({
      suggestionId: req.params.id,
      decision: "approved"
    });

    return res.status(201).json({
      suggestion,
      review
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to approve suggestion."
    });
  }
});

app.post("/suggestions/:id/reject", async (req, res) => {
  try {
    const suggestion =
      await findSuggestionById(req.params.id);

    if (!suggestion) {
      return res.status(404).json({
        error: "Suggestion not found."
      });
    }

    const existingReview =
      await findReviewBySuggestionId(req.params.id);

    if (existingReview) {
      return res.status(409).json({
        error: "Suggestion has already been reviewed.",
        review: existingReview
      });
    }

    const reason =
      typeof req.body?.reason === "string"
        ? req.body.reason.trim()
        : "";

    if (!reason) {
      return res.status(400).json({
        error: "Rejection reason is required."
      });
    }

    const review = await createReview({
      suggestionId: req.params.id,
      decision: "rejected",
      reason
    });

    return res.status(201).json({
      suggestion,
      review
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Failed to reject suggestion."
    });
  }
});

app.listen(port, () => {
  console.log(
    `Server listening on port ${port}`
  );
});