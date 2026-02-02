
import { GoogleGenAI, Type } from "@google/genai";
import { CalculationResult, StateTariff, Language, InsightFrequency } from "./types.ts";
import { LANG_LIST } from "./translations.ts";

const MASTER_PROMPT_CORE = `
You are the ELECA AI Engine. Provide household energy intelligence for Indian users.
Focus on actionable Rupee (₹) savings and tariff slab protection.
`;

const retryWithBackoff = async <T>(fn: () => Promise<T>, retries = 3, backoff = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.status === 500 || error?.code === 500 || String(error).includes('500'))) {
      await new Promise(resolve => setTimeout(resolve, backoff));
      return retryWithBackoff(fn, retries - 1, backoff * 2);
    }
    throw error;
  }
};

export const getTimedInsights = async (
  frequency: InsightFrequency,
  result: CalculationResult,
  stateTariff: StateTariff,
  language: Language
) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const langName = LANG_LIST.find(l => l.id === language)?.name || "English";
  
  const prompt = `
    FREQUENCY: ${frequency}
    UNITS: ${result.totalUnits.toFixed(1)} | STATE: ${stateTariff.name} | SEASON: ${result.season}
    LANGUAGE: ${langName}
    Analyze for savings and slab transitions. Use Markdown with ₹.
  `;

  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          systemInstruction: MASTER_PROMPT_CORE,
        },
      });
      return response.text || "No insights available right now.";
    });
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Insights are currently offline. Check back later for a fresh analysis.";
  }
};

export interface BeeLabelData {
  annualUnits?: number;
  iseer?: number;
  eer?: number;
  starRating?: number;
}

export const extractBeeLabelData = async (base64Image: string): Promise<BeeLabelData | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Extract technical parameters from this BEE Star Label. 
  Look for:
  1. Consumption (Units per Year/kWh per Year)
  2. ISEER (for Inverter ACs)
  3. EER (for Fixed Speed ACs)
  4. Star Rating (1 to 5)
  Return JSON.`;
  
  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Image } }]
        },
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              annualUnits: { type: Type.NUMBER, description: "Units consumed per year" },
              iseer: { type: Type.NUMBER, description: "ISEER value (cooling efficiency)" },
              eer: { type: Type.NUMBER, description: "EER value (cooling efficiency)" },
              starRating: { type: Type.NUMBER, description: "BEE Star rating (1-5)" }
            }
          }
        },
      });
      if (!response.text) return null;
      return JSON.parse(response.text.trim());
    });
  } catch (error) {
    console.error("Extraction Error:", error);
    return null;
  }
};

export const extractBillData = async (base64Image: string): Promise<{ units: number, amount: number } | null> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `Extract units and amount from bill. Return JSON.`;
  try {
    return await retryWithBackoff(async () => {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [{ text: prompt }, { inlineData: { mimeType: "image/jpeg", data: base64Image } }]
        },
        config: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              units: { type: Type.NUMBER, description: "Total units consumed" },
              amount: { type: Type.NUMBER, description: "Total bill amount" }
            },
            required: ["units", "amount"]
          }
        },
      });
      if (!response.text) return null;
      return JSON.parse(response.text.trim());
    });
  } catch (error) {
    console.error("Bill Extraction Error:", error);
    return null;
  }
};
