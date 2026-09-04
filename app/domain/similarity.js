export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) {
    throw new Error("Cosine similarity requires two arrays.");
  }

  if (a.length === 0 || b.length === 0) {
    throw new Error("Cosine similarity requires non-empty vectors.");
  }

  if (a.length !== b.length) {
    throw new Error(
      "Cosine similarity requires vectors of the same length."
    );
  }

  if (
    !a.every((value) => Number.isFinite(value)) ||
    !b.every((value) => Number.isFinite(value))
  ) {
    throw new Error(
      "Cosine similarity requires vectors containing only finite numbers."
    );
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i += 1) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] ** 2;
    magnitudeB += b[i] ** 2;
  }

  if (magnitudeA === 0 || magnitudeB === 0) {
    throw new Error(
      "Cosine similarity is undefined for a zero vector."
    );
  }

  return (
    dotProduct /
    (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB))
  );
}
