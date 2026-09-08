export class EmbeddingProvider {
  async embedText() {
    throw new Error(
      "EmbeddingProvider.embedText() must be implemented by a provider."
    );
  }
}
