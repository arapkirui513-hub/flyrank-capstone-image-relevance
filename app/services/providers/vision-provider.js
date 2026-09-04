export class VisionProvider {
  async analyzeImage(_imageBuffer) {
    throw new Error(
      "VisionProvider.analyzeImage() must be implemented by a provider."
    );
  }
}
