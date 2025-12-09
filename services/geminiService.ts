import { GoogleGenAI, Type } from "@google/genai";
import { DocumentAnalysis } from "../types";

const processFile = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = (error) => reject(error);
  });
};

export const analyzeDocument = async (file: File): Promise<DocumentAnalysis> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key not found in environment variables");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = await processFile(file);

  // Schema for structured output
  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      documentType: { type: Type.STRING, description: "The specific type of document (e.g., Invoice, Medical Prescription, W-2 Form)." },
      summary: { type: Type.STRING, description: "A concise, human-readable summary of the document's content and purpose." },
      fields: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            key: { type: Type.STRING, description: "A normalized key for the field (camelCase)." },
            label: { type: Type.STRING, description: "The human-readable label found on the document." },
            value: { type: Type.STRING, description: "The extracted value. Use 'N/A' or empty string if blank. Correct spelling errors in general text, but PRESERVE names/IDs exactly." },
            type: { 
              type: Type.STRING, 
              enum: ['text', 'date', 'number', 'checkbox', 'currency', 'signature', 'email', 'phone', 'address', 'image'],
              description: "The semantic type of the input field."
            },
            status: { type: Type.STRING, enum: ['filled', 'empty', 'uncertain', 'skipped'], description: "Whether the field has a value or is blank." },
            required: { type: Type.BOOLEAN, description: "True if this field is mandatory for the form to be valid." },
            example: { type: Type.STRING, description: "A realistic example value or placeholder format for this field (e.g., 'name@example.com')." },
            explanation: { type: Type.STRING, description: "Brief reason for this extraction or why it is considered missing." },
            boundingBox: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
              description: "The bounding box of the field area [ymin, xmin, ymax, xmax] in normalized coordinates (0-1). If the field is empty, estimate where the value SHOULD be written."
            }
          },
          required: ["key", "label", "value", "type", "status", "required"]
        }
      },
      missingFields: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "A list of keys or labels for fields that are REQUIRED but are empty."
      },
      securityRisks: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Potential security or privacy risks (e.g., exposed SSN, unredacted PII)."
      },
      actionableInsights: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "Instructions for the user (e.g., 'Sign at the bottom', 'Fill in date')."
      }
    },
    required: ["documentType", "summary", "fields"]
  };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview", // Using Pro for better reasoning on complex docs
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          {
            text: `Analyze this document image to create a digital form.
            
            1. Extract all visible form fields.
            2. For each field, identify the most appropriate input type (email, phone, address, etc.).
            3. Determine if the field is 'required' based on context (asterisks, standard form rules).
            4. Provide a realistic 'example' value for each field to help the user.
            5. IMPORTANT: Identify the BOUNDING BOX [ymin, xmin, ymax, xmax] for every field. If a field is empty, mark the area where the user should write/type the answer.
            
            SPELLING CORRECTION RULES:
            - For general text (descriptions, notes, instructions), correct obvious spelling errors.
            - For PERSONAL DETAILS (Names, IDs, Addresses, License Numbers), EXTRACT EXACTLY AS IS. Do not auto-correct personal data.

            Return the data in the specified JSON structure.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 2048 }
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from Gemini");
    }

    const data = JSON.parse(text) as DocumentAnalysis;
    return data;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};