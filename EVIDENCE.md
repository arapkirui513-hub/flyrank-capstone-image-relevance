# EVIDENCE

This file contains concrete proof for the capstone requirements.

Evidence must be added as the corresponding functionality is implemented and
verified. Planned functionality is not treated as evidence.

## Phase 1

### Design document

Status: IN PROGRESS

Evidence:
- `docs/design.md`

### Dataset

Status: NOT YET VERIFIED

Target:
- 40-50 images
- 4 categories

Required evidence:
- selected image records
- source URLs
- license/source information
- manual subject verification

## Section 6 Requirements

### 1. Vision structured output + schema validation

Status: NOT IMPLEMENTED

### 2. Low-confidence classification handling

Status: NOT IMPLEMENTED

### 3. Batch processing + retries

Status: NOT IMPLEMENTED

### 4. Embeddings and semantic matching

Status: NOT IMPLEMENTED

### 5. Mismatch guard

Status: NOT IMPLEMENTED

### 6. Human-readable rejection

Status: NOT IMPLEMENTED

### 7. No-confident-match behavior

Status: NOT IMPLEMENTED

### 8. Persistence

Status: NOT IMPLEMENTED

### 9. Review API

Status: NOT IMPLEMENTED

### 10. Evaluation dataset and top-1 precision

Status: NOT IMPLEMENTED

### 11. AI cost tracking

Status: NOT IMPLEMENTED

### GPL-licensed Wikimedia images

Three sterilizer images (`st-006`, `st-007`, and `st-008`) were identified through the Wikimedia provenance audit with the GNU General Public License (GPL).

The license was manually confirmed against the Wikimedia Commons source pages. The GPL designation was therefore treated as genuine rather than corrected to GFDL.

Although the images are validly sourced and their local SHA-256 hashes match the recorded values, they were excluded from the final corpus because GPL licensing introduces a less straightforward redistribution/source-availability question for photographic assets than the licenses used by the replacement candidates.

The exclusion is a corpus-curation decision, not a claim that the images were improperly licensed.
