import { VisionProvider } from "../vision-provider.js";

export class MockVisionProvider extends VisionProvider {
  constructor(metadata = {}) {
    super();

    this.metadata = {
      subject: "patient monitor",
      category: "medical_equipment",
      attributes: ["bedside", "vital signs", "display"],
      caption: "A patient monitor displaying vital signs.",
      confidence: 0.92,
      ...metadata
    };
  }

  async analyzeImage(_imageBuffer) {
    return this.metadata;
  }
}
