export class VisionProvider {
  async analyzeImage() {
    throw new Error(
      "VisionProvider.analyzeImage() must be implemented by a provider."
    );
  }
}
