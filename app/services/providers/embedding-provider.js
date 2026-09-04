export class EmbeddingProvider {
  async embedText(_text) {
    throw new Error(
      "EmbeddingProvider.embedText() must be implemented by a provider."
    );
  }
}
