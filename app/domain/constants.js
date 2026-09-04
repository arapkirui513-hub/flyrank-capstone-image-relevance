export const GUARD_DECISIONS = {
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  NO_CONFIDENT_MATCH: "no_confident_match"
};

export const REJECTION_REASONS = {
  LOW_CONFIDENCE: "Vision model confidence below minimum threshold.",
  SIMILARITY_BELOW_THRESHOLD: "Semantic similarity score is too low.",
  SUBJECT_MISMATCH:
    "Subject mismatch: expected {expected}, detected {detected}.",
  NO_CANDIDATES:
    "No images available in the corpus for this category."
};

export const THRESHOLDS = {
  MIN_CONFIDENCE: 0.70,
  SIMILARITY_THRESHOLD: 0.65
};

export const CATEGORIES = {
  MEDICAL_EQUIPMENT: "medical_equipment"
};

export const SUBJECTS = {
  PATIENT_MONITOR: "patient monitor",
  DEFIBRILLATOR: "defibrillator",
  STERILIZER: "sterilizer",
  HOSPITAL_BED: "hospital bed"
};