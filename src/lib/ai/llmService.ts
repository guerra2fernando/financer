/* eslint-disable @typescript-eslint/no-explicit-any */
// src/lib/ai/llmService.ts
import OpenAI from 'openai';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold, GenerationConfig } from "@google/generative-ai";
import { AISuggestedBudgetCategory } from '@/types'; // ExpenseCategoryString will resolve to ExpenseCategorySlug
import { parseAIResponse } from './promptUtils';

// --- Configuration ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const GEMINI_MODEL_NAME = "gemini-2.0-flash"; // Use the latest flash model
const OPENAI_MODEL_NAME = "gpt-4-turbo-preview"; // Or "gpt-4", "gpt-4-0125-preview"

// --- Initialize Clients ---
let genAI: GoogleGenerativeAI | null = null;
if (GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
} else {
  console.warn("Gemini API key not found. Gemini service will be unavailable.");
}

let openai: OpenAI | null = null;
if (OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: OPENAI_API_KEY });
} else {
  console.warn("OpenAI API key not found. OpenAI service will be unavailable.");
}

interface LLMResponse {
    recommendations: AISuggestedBudgetCategory[] | null;
    rawResponse?: string;
    modelUsed: string;
    error?: string;
    source: 'Gemini' | 'OpenAI' | 'N/A';
}

const 안전등급설정: GenerationConfig = {
    // temperature: 0.9, // Default is 0.9, for financial advice, might want lower
    // topK: 1, // Default
    // topP: 1, // Default
    // maxOutputTokens: 2048, // Default
    // stopSequences: [], // Default
    // For Gemini, explicitly ask for JSON output if the model/SDK supports it.
    // The prompt already requests JSON, but this can be an additional hint.
    // responseMimeType: "application/json", // Supported in gemini-1.5-pro-latest, check for flash
    // Not using responseMimeType for broader compatibility for now, relying on prompt.
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
];


async function getBudgetFromGemini(prompt: string): Promise<LLMResponse> {
  if (!genAI) {
    return { recommendations: null, modelUsed: GEMINI_MODEL_NAME, error: "Gemini client not initialized (API key missing).", source: "Gemini" };
  }

  try {
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        generationConfig: 안전등급설정, // Apply generation config
        safetySettings: safetySettings, // Apply safety settings
    });
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const responseText = response.text();

    if (!responseText) {
      console.error('Gemini response text is empty.');
      return { recommendations: null, rawResponse: '', modelUsed: GEMINI_MODEL_NAME, error: "Empty response from Gemini.", source: "Gemini" };
    }
    
    const recommendations = parseAIResponse(responseText, "Gemini");

    if (!recommendations) {
         return { recommendations: null, rawResponse: responseText, modelUsed: GEMINI_MODEL_NAME, error: "Failed to parse Gemini response.", source: "Gemini" };
    }
    return { recommendations, rawResponse: responseText, modelUsed: GEMINI_MODEL_NAME, source: "Gemini" };

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    let message = "Failed to get recommendations from Gemini.";
    if (error.message) message = error.message;
    // Check for specific Gemini error types if available from SDK
    return { recommendations: null, modelUsed: GEMINI_MODEL_NAME, error: message, source: "Gemini" };
  }
}

async function getBudgetFromOpenAI(prompt: string): Promise<LLMResponse> {
  if (!openai) {
    return { recommendations: null, modelUsed: OPENAI_MODEL_NAME, error: "OpenAI client not initialized (API key missing).", source: "OpenAI" };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: OPENAI_MODEL_NAME,
      response_format: { type: "json_object" }, // Crucial for reliable JSON from OpenAI
      messages: [
        // System prompt can reinforce JSON output and role
        { role: "system", content: "You are a helpful financial advisor. Your output MUST be a single, valid JSON object as per the user's detailed instructions, with no other text or markdown." },
        { role: "user", content: prompt }
      ],
      temperature: 0.2, // Lower for more deterministic financial advice
      max_tokens: 3000, // Generous for detailed budget
    });

    const responseText = completion.choices[0]?.message?.content;

    if (!responseText) {
      console.error('OpenAI response text is empty.');
      return { recommendations: null, rawResponse: '', modelUsed: OPENAI_MODEL_NAME, error: "Empty response from OpenAI.", source: "OpenAI" };
    }

    const recommendations = parseAIResponse(responseText, "OpenAI");
    if (!recommendations) {
         return { recommendations: null, rawResponse: responseText, modelUsed: OPENAI_MODEL_NAME, error: "Failed to parse OpenAI response.", source: "OpenAI" };
    }

    return { recommendations, rawResponse: responseText, modelUsed: OPENAI_MODEL_NAME, source: "OpenAI" };

  } catch (error: any) {
    console.error("Error calling OpenAI API:", error);
    let errorMessage = "Failed to get recommendations from OpenAI.";
    if (error instanceof OpenAI.APIError) { // More specific OpenAI error handling
        errorMessage = `OpenAI API Error (${error.status}): ${error.name} - ${error.message}`;
    } else if (error.message) {
        errorMessage = error.message;
    }
    return { recommendations: null, modelUsed: OPENAI_MODEL_NAME, error: errorMessage, source: "OpenAI" };
  }
}


// Main service function with fallback logic
export async function getBudgetRecommendations(prompt: string): Promise<LLMResponse> {
  if (GEMINI_API_KEY && genAI) { // Prioritize Gemini if key and client exist
    console.log("Attempting budget recommendation with Gemini...");
    const geminiResult = await getBudgetFromGemini(prompt);
    if (geminiResult.recommendations && geminiResult.recommendations.length > 0) {
      console.log("Successfully received recommendations from Gemini.");
      return geminiResult;
    }
    console.warn("Gemini failed or returned no valid recommendations. Error:", geminiResult.error, "Raw:", geminiResult.rawResponse?.substring(0,500));
    // Fall through to OpenAI if Gemini fails
    if (!OPENAI_API_KEY || !openai) { // If OpenAI is also not available, return Gemini's error
        return geminiResult; // Or a more generic error: { recommendations: null, modelUsed: 'N/A', error: 'Primary LLM (Gemini) failed and fallback (OpenAI) is not configured.', source: 'N/A' };
    }
    console.log("Falling back to OpenAI...");
  } else if (!OPENAI_API_KEY || !openai) {
    console.error("No LLM services are configured (Gemini and OpenAI API keys missing or clients not initialized).");
    return { recommendations: null, modelUsed: 'N/A', error: "No LLM services configured.", source: 'N/A' };
  }


  // Attempt OpenAI if Gemini was skipped or failed (and OpenAI is configured)
  if (OPENAI_API_KEY && openai) {
    console.log("Attempting budget recommendation with OpenAI...");
    const openaiResult = await getBudgetFromOpenAI(prompt);
     if (openaiResult.recommendations && openaiResult.recommendations.length > 0) {
      console.log("Successfully received recommendations from OpenAI.");
      return openaiResult;
    }
    console.warn("OpenAI also failed or returned no valid recommendations. Error:", openaiResult.error, "Raw:", openaiResult.rawResponse?.substring(0,500));
    return openaiResult; // Return OpenAI's result even if it's an error/empty
  }

  // Should not be reached if logic is correct, but as a final fallback:
  return { recommendations: null, modelUsed: 'N/A', error: "All LLM services failed or are not configured.", source: 'N/A' };
}