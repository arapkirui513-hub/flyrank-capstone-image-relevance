CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT images_status_check
        CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

CREATE TABLE image_metadata (
    image_id UUID PRIMARY KEY REFERENCES images(id) ON DELETE CASCADE,
    subject TEXT NOT NULL,
    attributes JSONB NOT NULL DEFAULT '[]'::jsonb,
    caption TEXT NOT NULL,
    confidence NUMERIC(4,3) NOT NULL,

    CONSTRAINT image_metadata_confidence_check
        CHECK (confidence >= 0 AND confidence <= 1)
);

CREATE TABLE image_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    model_version TEXT NOT NULL,
    embedding JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT image_embeddings_unique_model
        UNIQUE (image_id, model, model_version)
);

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE post_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    model TEXT NOT NULL,
    model_version TEXT NOT NULL,
    embedding JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT post_embeddings_unique_model
        UNIQUE (post_id, model, model_version)
);

CREATE TABLE suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
    similarity_score NUMERIC(6,5) NOT NULL,
    guard_decision TEXT NOT NULL,
    rejection_reason TEXT,
    guard_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT suggestions_decision_check
        CHECK (guard_decision IN ('accepted', 'rejected')),

    CONSTRAINT suggestions_similarity_check
        CHECK (similarity_score >= -1 AND similarity_score <= 1),

    CONSTRAINT suggestions_rejection_reason_check
        CHECK (
            (guard_decision = 'accepted' AND rejection_reason IS NULL)
            OR
            (guard_decision = 'rejected' AND rejection_reason IS NOT NULL)
        )
);

CREATE TABLE reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID NOT NULL REFERENCES suggestions(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    reason TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT reviews_decision_check
        CHECK (decision IN ('approved', 'rejected'))
);

CREATE TABLE jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total_items INTEGER NOT NULL DEFAULT 0,
    processed_items INTEGER NOT NULL DEFAULT 0,
    failed_items INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    CONSTRAINT jobs_status_check
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),

    CONSTRAINT jobs_counts_check
        CHECK (
            total_items >= 0
            AND processed_items >= 0
            AND failed_items >= 0
            AND processed_items + failed_items <= total_items
        )
);

CREATE TABLE ai_cost_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES jobs(id) ON DELETE SET NULL,
    operation TEXT NOT NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER NOT NULL,
    estimated_cost_usd NUMERIC(12,8),
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_cost_logs_duration_check
        CHECK (duration_ms >= 0),

    CONSTRAINT ai_cost_logs_tokens_check
        CHECK (
            (input_tokens IS NULL OR input_tokens >= 0)
            AND
            (output_tokens IS NULL OR output_tokens >= 0)
        ),

    CONSTRAINT ai_cost_logs_cost_check
        CHECK (
            estimated_cost_usd IS NULL
            OR estimated_cost_usd >= 0
        )
);

CREATE INDEX idx_images_status
    ON images(status);

CREATE INDEX idx_images_category
    ON images(category);

CREATE INDEX idx_suggestions_post
    ON suggestions(post_id);

CREATE INDEX idx_suggestions_image
    ON suggestions(image_id);

CREATE INDEX idx_suggestions_decision
    ON suggestions(guard_decision);

CREATE INDEX idx_suggestions_created_at
    ON suggestions(created_at);

CREATE INDEX idx_jobs_status
    ON jobs(status);

CREATE INDEX idx_ai_cost_logs_job
    ON ai_cost_logs(job_id);

CREATE INDEX idx_ai_cost_logs_created_at
    ON ai_cost_logs(created_at);