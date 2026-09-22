# AI Image Understanding & Content Matching Engine

An AI-assisted image understanding and content matching engine for healthcare equipment content.

The system combines structured vision metadata, semantic embeddings, cosine-similarity retrieval, and a validation guard to recommend images for healthcare-related content while keeping human review in the loop.

**Important:** This is a content-matching system, not a clinical AI system.

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Architecture](#2-architecture)
3. [End-to-End Pipeline](#3-end-to-end-pipeline)
4. [Background Image Processing](#4-background-image-processing)
5. [AI Cost Logging](#5-ai-cost-logging)
6. [Persistence](#6-persistence)
7. [API](#7-api)
8. [Running Locally](#8-running-locally)
9. [Environment](#9-environment)
10. [Start PostgreSQL](#10-start-postgresql)
11. [Start the API](#11-start-the-api)
12. [Run the Full Docker Stack](#12-run-the-full-docker-stack)
13. [Dataset and Corpus](#13-dataset-and-corpus)
14. [V2 Evaluation](#14-v2-evaluation)
15. [Automated Testing](#15-automated-testing)
16. [End-to-End Example](#16-end-to-end-example)
17. [Key Design Decisions](#17-key-design-decisions)
18. [Limitations](#18-limitations)
19. [Safety Boundary](#19-safety-boundary)
20. [Project Structure](#20-project-structure)
21. [AI-Assisted Development Transparency](#21-ai-assisted-development-transparency)
22. [Current Verification Status](#22-current-verification-status)

---

## 1. What This Project Does

### Problem

Similarity-only image retrieval can return images that look or read as semantically related while still representing the wrong equipment.

For healthcare content, that distinction matters. A visually similar device can still be the wrong device category.

This project separates **retrieval** from **validation**.

### Intended users

The system is designed for teams producing healthcare equipment content that need a structured way to:

* process equipment images
* extract image metadata
* generate semantic embeddings
* retrieve visually/semantically related candidates
* reject incompatible candidates
* review accepted suggestions
* track AI usage and estimated cost

### Supported equipment categories

The verified corpus currently contains four categories:

* `patient_monitor`
* `defibrillator`
* `sterilizer`
* `hospital_bed`

---

## 2. Architecture

```text
                         ┌─────────────────────┐
                         │      REST API       │
                         │       Express       │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 │                  │                  │
                 ▼                  ▼                  ▼
          Image Processing      Post Embedding    Suggestions
                 │                  │                  │
                 ▼                  ▼                  ▼
          Vision Provider     Embedding Provider   Matching Service
                 │                  │                  │
          ┌──────┴──────┐           │                  ▼
          │             │           │           Cosine Similarity
       Gemini         Groq          │                  │
          │             │           │                  ▼
          └─────────────┘           │            Mismatch Guard
                                    │                  │
                                    └──────────┬───────┘
                                               │
                                               ▼
                                         Human Review
                                               │
                                               ▼
                                           PostgreSQL
```

### Provider abstraction

Vision analysis is exposed through a common provider contract:

```text
VisionProvider
├── GeminiVisionProvider
└── GroqVisionProvider
```

Embedding generation uses:

```text
EmbeddingProvider
└── GeminiEmbeddingProvider
```

This keeps provider-specific implementation separate from the matching and validation logic.

---

## 3. End-to-End Pipeline

The core flow is:

```text
Image
  │
  ▼
Vision analysis
  │
  ├── subject
  ├── category
  ├── attributes
  ├── caption
  └── confidence
  │
  ▼
Semantic embedding
  │
  ▼
Post embedding
  │
  ▼
Cosine-similarity retrieval
  │
  ▼
Candidate ranking
  │
  ▼
Mismatch guard
  │
  ├── confidence threshold
  ├── similarity threshold
  └── subject compatibility
  │
  ├── accepted
  ├── rejected
  └── no_confident_match
  │
  ▼
Human review
```

The system uses two explicit thresholds:

* Vision confidence: `0.70`
* Similarity: `0.65`

A candidate must satisfy the guard conditions before being accepted.

---

## 4. Background Image Processing

Image corpus processing runs through a background job lifecycle.

```text
pending
   │
   ▼
running
   │
   ├──────────────► completed
   │
   └──────────────► failed
```

The job tracks:

* total images
* processed images
* progress
* successful processing
* failed processing
* retries
* AI usage
* estimated cost

Image processing retries failed operations up to the configured retry limit.

Corpus ingestion is idempotent by filename, with database uniqueness constraints preventing duplicate corpus entries.

---

## 5. AI Cost Logging

Every AI operation can produce a cost log containing:

* operation
* provider
* model
* input tokens
* output tokens
* duration
* estimated cost
* success/failure
* error information
* associated job ID

This makes AI usage observable instead of treating model calls as opaque application behavior.

---

## 6. Persistence

PostgreSQL stores the main application state, including:

* images
* image metadata
* image embeddings
* posts
* post embeddings
* suggestions
* reviews
* processing jobs
* AI cost logs

Database constraints are used to protect data integrity.

The verified corpus integrity checks found:

| Check                        | Result |
| ---------------------------- | -----: |
| Corpus images                |     43 |
| Metadata rows                |     43 |
| Distinct metadata image IDs  |     43 |
| Metadata orphans             |      0 |
| Metadata duplicates          |      0 |
| Embedding rows               |     43 |
| Distinct embedding image IDs |     43 |
| Embedding orphans            |      0 |
| Embedding duplicates         |      0 |
| Unique corpus filenames      |     43 |

---

## 7. API

### Health

```http
GET /health
```

### Images

```http
POST /images
GET /images
GET /images/:id
```

### Image processing jobs

```http
POST /jobs/image-processing
GET /jobs
GET /jobs/:id
```

### Posts

```http
POST /posts
GET /posts/:id
GET /posts/:id/images
POST /posts/:postId/embed
```

### Suggestions

```http
POST /posts/:postId/suggestions
GET /suggestions/:id
POST /suggestions/:id/approve
POST /suggestions/:id/reject
```

The suggestion workflow therefore separates automated candidate generation from the final review decision.

---

## 8. Running Locally

### Requirements

* Node.js
* npm
* Docker Desktop
* PostgreSQL through the provided Docker Compose configuration
* Required AI provider API key(s)

Install dependencies:

```powershell
npm install
```

Create the local environment file:

```powershell
Copy-Item .env.example .env
```

Update `.env` with the required provider credentials and database configuration.

For the Docker PostgreSQL instance exposed to the host, the local database URL is:

```text
postgresql://postgres:postgres@localhost:5433/image_relevance
```

---

## 9. Environment

The application uses environment variables for database configuration, AI provider credentials, and AI cost estimation.

Example:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/image_relevance

GEMINI_API_KEY=your_key_here
GROQ_API_KEY=your_key_here
```

Cost-per-million-token variables are also supported by the application.

Do not commit real API keys.

---

## 10. Start PostgreSQL

Start the database container:

```powershell
docker compose up -d db
```

Verify it:

```powershell
docker compose ps
```

The expected host mapping is:

```text
0.0.0.0:5433 -> 5432/tcp
```

The database must be running before executing the repository integration tests.

---

## 11. Start the API

Run the application in development mode:

```powershell
npm run dev
```

The API runs on the configured application port, with the default development setup using:

```text
http://localhost:3000
```

Health check:

```powershell
curl http://localhost:3000/health
```

---

## 12. Run the Full Docker Stack

The project also includes a Docker Compose configuration for the application and PostgreSQL database.

Start the stack:

```powershell
docker compose up --build
```

Stop the stack:

```powershell
docker compose down
```

---

## 13. Dataset and Corpus

The verified corpus contains **43 images** across four equipment categories:

* patient monitors
* defibrillators
* sterilizers
* hospital beds

The corpus was built with attention to image licensing and source verification.

Three GPL-licensed sterilizer images were excluded and replaced with verified public-domain Wikimedia Commons candidates.

The evaluation dataset is represented by:

```text
data/evaluation.csv
```

The evaluation runner is:

```text
scripts/run-evaluation.js
```

Ground-truth labels distinguish positive examples, hard negatives, and rejected candidates.

---

## 14. V2 Evaluation

The latest verified evaluation was run on **2026-09-22** after starting the PostgreSQL container and running the complete test suite.

### Overall results

| Metric                   | Result |
| ------------------------ | -----: |
| Posts evaluated          |     12 |
| Candidates evaluated     |    120 |
| Retrieved true positives |     72 |
| Retrieval Precision@10   | 60.00% |
| Accepted suggestions     |     45 |
| Accepted true positives  |     30 |
| Accepted false positives |     15 |
| Guarded Precision        | 66.67% |

The evaluation covered three posts for each of the four equipment categories.

### Per-category results

| Category        | Retrieval Precision@10 | Guarded Precision |
| --------------- | ---------------------: | ----------------: |
| Defibrillator   |                 80.00% |           100.00% |
| Hospital bed    |                 40.00% |           100.00% |
| Patient monitor |                 20.00% |            28.57% |
| Sterilizer      |                100.00% |           100.00% |

### Interpretation

The validation guard improves precision for three of the four evaluated categories.

The main weakness is **patient-monitor matching**.

Some hard-negative images are themselves classified by the vision model as patient monitors with high confidence. When the expected subject and model subject agree, the current guard can still accept a candidate even when its similarity score is not strong enough to distinguish the specific equipment context.

This limitation is documented rather than hidden through additional threshold tuning.

Recall is not reported because the evaluation does not guarantee that every labeled positive appears in the retrieved candidate set.

The evaluation output is also written to:

```text
data/evaluation-results.json
```

---

## 15. Automated Testing

The project uses Node's built-in test runner.

Run:

```powershell
npm test
```

The verified run on 2026-09-22 produced:

```text
tests 89
pass 89
fail 0
cancelled 0
skipped 0
todo 0
```

The test suite covers:

* subject normalization and aliases
* vision metadata validation
* confidence handling
* cosine similarity
* mismatch guard behavior
* repository persistence
* database relationships and cascades
* job lifecycle
* retry behavior
* image processing
* post embedding
* AI cost logging
* Gemini embedding provider
* Gemini vision provider
* Groq vision provider
* provider contracts

Some service tests intentionally trigger simulated failures so retry and error-handling paths can be verified. Those messages are expected test output and do not represent failing tests.

---

## 16. End-to-End Example

A complete content-matching flow can be reproduced through the API.

### Step 1: Upload an image

Create an image record:

```http
POST /images
```

The image enters the image-processing pipeline.

### Step 2: Trigger image processing

Start processing pending images:

```http
POST /jobs/image-processing
```

The job:

1. selects pending images
2. runs vision analysis
3. stores structured metadata
4. generates an embedding
5. persists the embedding
6. records AI usage
7. updates job progress

### Step 3: Create a content post

Create a post representing the healthcare content that needs an image.

```http
POST /posts
```

The post is stored in PostgreSQL.

### Step 4: Embed the post

Generate a semantic embedding for the post:

```http
POST /posts/:postId/embed
```

The embedding is persisted and the AI operation is logged.

### Step 5: Generate suggestions

Request candidate images:

```http
POST /posts/:postId/suggestions
```

The matching service:

1. compares the post embedding against image embeddings
2. ranks candidates using cosine similarity
3. supplies candidate metadata to the mismatch guard
4. applies confidence, similarity, and subject compatibility checks

### Step 6: Review the suggestion

An accepted candidate can be approved:

```http
POST /suggestions/:id/approve
```

Or rejected:

```http
POST /suggestions/:id/reject
```

The result is stored as a review record.

This creates the complete path:

```text
Image
  → processing job
  → vision metadata
  → image embedding
  → content post
  → post embedding
  → candidate retrieval
  → mismatch guard
  → human review
  → approved/rejected suggestion
```

---

## 17. Key Design Decisions

### Retrieval and validation are separate stages

The most important architectural decision is separating **candidate retrieval** from **candidate validation**.

The matching service answers:

> Which images are semantically similar to this content?

The mismatch guard then asks:

> Is this candidate compatible enough to accept?

This makes it possible to measure retrieval quality separately from validation behavior.

It also makes failures easier to diagnose. A bad result can originate from retrieval, vision classification, thresholding, or subject compatibility rather than being treated as one undifferentiated matching failure.

### Structured metadata instead of raw model output

Vision output is validated against a schema before being persisted.

This gives downstream services predictable fields such as:

* subject
* category
* attributes
* caption
* confidence

### AI calls are observable

AI operations are logged with provider, model, usage, duration, success/failure, and estimated cost where available.

### Provider interfaces

Vision and embedding providers use explicit contracts so provider-specific code does not leak into the core matching logic.

### Database constraints protect corpus integrity

Unique constraints prevent duplicate corpus filenames and help maintain one metadata and embedding record per image.

---

## 18. Limitations

### Patient-monitor hard negatives

Patient-monitor matching is the current evaluation weakness.

The vision model can confidently classify some hard negatives as patient monitors. Because the guard uses subject compatibility as one of its checks, subject agreement can allow visually weaker candidates through.

The latest evaluation produced:

```text
Patient monitor
Retrieval Precision@10: 20.00%
Guarded Precision: 28.57%
```

This is the primary area for further improvement.

### Small evaluation corpus

The evaluation uses 12 posts across four equipment categories.

The results should therefore be treated as evaluation evidence for this corpus, not as a general benchmark for healthcare image retrieval.

### Limited category coverage

Only four equipment categories are currently represented in the verified corpus.

Additional categories would be needed to assess behavior across a broader healthcare equipment vocabulary.

### Retrieval recall is not measured

The current evaluation focuses on Precision@10 and guarded precision.

It does not report recall because the evaluation does not establish that every positive image is present in the candidate set.

### Human review remains necessary

The system generates and validates suggestions. It does not establish that an accepted image is appropriate for every publishing context.

---

## 19. Safety Boundary

This project is **not a clinical AI system**.

It does not perform:

* patient diagnosis
* clinical image interpretation for patient care
* treatment recommendations
* patient-care decisions
* biomedical equipment fault diagnosis
* replacement of biomedical engineering judgment
* replacement of clinical review

Its purpose is content matching and workflow support for healthcare equipment-related content.

Human review remains part of the final suggestion workflow.

---

## 20. Project Structure

```text
app/
├── main.js
├── container.js
├── providers/
├── repositories/
└── services/

migrations/

scripts/
├── process-image-corpus.js
└── run-evaluation.js

tests/
├── providers/
├── repositories/
├── services/
└── ...

data/
├── evaluation.csv
└── evaluation-results.json

docs/
└── design.md

capstone.yaml
EVIDENCE.md
docker-compose.yml
package.json
README.md
```

---

## 21. AI-Assisted Development Transparency

AI-assisted development was used during implementation for code generation, debugging, test design, documentation, and development support.

The implemented system was not accepted solely from generated output.

Implementation decisions and outputs were checked through:

* local execution
* PostgreSQL persistence tests
* provider contract tests
* API behavior
* corpus integrity checks
* retry and failure-path tests
* end-to-end processing
* evaluation runs
* inspection of generated evaluation results

The developer checked the resulting behavior and used test and evaluation output to determine what could be documented as verified.

The evaluation limitation around patient-monitor hard negatives is explicitly documented rather than removed or hidden to improve the reported metric.

---

## 22. Current Verification Status

Latest verification date: **2026-09-22**

### Test status

```text
89 tests
89 passing
0 failing
```

### Evaluation status

```text
12 posts evaluated
120 candidates evaluated
72 retrieval true positives
60.00% Retrieval Precision@10
45 accepted suggestions
30 accepted true positives
15 accepted false positives
66.67% Guarded Precision
```

### Corpus status

```text
43 corpus images
43 metadata rows
43 embedding rows
0 metadata orphans
0 embedding orphans
0 duplicate metadata records
0 duplicate embedding records
```

### Current assessment

The core capstone pipeline is implemented and locally verified.

The current evaluation demonstrates measurable separation between semantic retrieval and validation, while also exposing a specific weakness in patient-monitor hard-negative handling.

The next iteration should focus on improving subject-level discrimination for patient-monitor candidates rather than simply tuning thresholds against the current evaluation set.
