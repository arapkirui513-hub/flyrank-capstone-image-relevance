import { EmbeddingProvider } from "../embedding-provider.js";

export class MockEmbeddingProvider extends EmbeddingProvider {
  constructor(embedding = [0.12, 0.34, 0.56, 0.78]) {
    super();

    this.embedding = embedding;
  }

  async embedText(_text) {
    return this.embedding;
  }
}
