import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to parse base64 data string
const parseBase64 = (base64String: string) => {
  const matches = base64String.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid input string');
  }
  return {
    mimeType: matches[1],
    data: matches[2]
  };
};

export const generateTestImage = async (prompt: string, referenceImage?: string): Promise<string> => {
  try {
    const parts: any[] = [{ text: prompt }];

    if (referenceImage) {
      const { mimeType, data } = parseBase64(referenceImage);
      parts.unshift({
        inlineData: {
          mimeType: mimeType,
          data: data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Supports image input
      contents: {
        parts: parts
      }
    });

    // Extract image from parts
    if (response.candidates && response.candidates[0].content && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("No image data found in response");
  } catch (error) {
    console.error("Gemini Image Gen Error:", error);
    throw error;
  }
};

export const generateComparisonPair = async (prompt: string, referenceImage?: string): Promise<{ imageA: string, imageB: string }> => {
  // Simulate two different model behaviors or versions
  // In a real app, you might map 'prompt' to 'prompt + optimization_v1' vs 'prompt + optimization_v2'
  
  const [resA, resB] = await Promise.all([
    generateTestImage(prompt + " --v 1", referenceImage), 
    generateTestImage(prompt + " --v 2", referenceImage)
  ]);

  return { imageA: resA, imageB: resB };
};