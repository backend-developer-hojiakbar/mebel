import { GoogleGenAI, Type } from "@google/genai";
import { AnalysisRequest, AnalysisResult, Product, Supplier, AnalysisProgress, ContractDetails, PotentialScore, AdditionalCosts, BidRecommendation, QuickSearchResult, GenerativePart, TenderPlatform, TenderType } from '../types';
import { getUzsPrice } from '../utils/currency';
import { extractTextFromFile } from '../utils/fileExtractor';


// --- CONFIGURATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const SERPER_API_KEY = '267bb61332ef769cb728f3607a8a8239660cf3d7'; // User-provided Serper API Key

const languageMap = {
    'uz': 'Uzbek (Latin script)',
    'uz-Cyrl': 'Uzbek (Cyrillic script)',
    'ru': 'Russian',
};

// --- UTILITY FUNCTIONS ---
const safeJsonParse = <T>(jsonString: string): T | null => {
    try {
        let textToParse = jsonString.trim();
        const markdownMatch = textToParse.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (markdownMatch && markdownMatch[1]) {
            textToParse = markdownMatch[1];
        } else {
            const firstBracket = textToParse.indexOf('[');
            const firstBrace = textToParse.indexOf('{');
            let startIndex = -1;
            if (firstBracket !== -1 && firstBrace !== -1) {
                startIndex = Math.min(firstBracket, firstBrace);
            } else if (firstBracket !== -1) {
                startIndex = firstBracket;
            } else {
                startIndex = firstBrace;
            }
            if (startIndex !== -1) {
                textToParse = textToParse.substring(startIndex);
            }
        }
        return JSON.parse(textToParse) as T;
    } catch (e) {
        console.error("JSON parsing error:", e);
        console.error("Original string:", jsonString);
        return null;
    }
};

/**
 * Fetches a file from a URL using a CORS proxy and extracts its text content.
 * @param fileUrl The URL of the file to fetch.
 * @returns A promise that resolves to the extracted text content, or an empty string on failure.
 */
const fetchAndExtractFile = async (fileUrl: string): Promise<string> => {
    try {
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(fileUrl)}`;
        const response = await fetch(proxiedUrl);
        if (!response.ok) {
            throw new Error(`Failed to fetch file: ${response.statusText}`);
        }
        const blob = await response.blob();
        
        const urlParts = fileUrl.split('/');
        const fileName = urlParts[urlParts.length - 1] || 'downloaded-file';
        
        const file = new File([blob], fileName, { type: blob.type });

        return await extractTextFromFile(file);
    } catch (error) {
        console.error(`Error fetching and extracting file from ${fileUrl}:`, error);
        return ''; // Return empty string on failure, allowing analysis to continue.
    }
};


const imageUrlToGenerativePart = async (url: string): Promise<GenerativePart | null> => {
    try {
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const response = await fetch(proxiedUrl);
        if (!response.ok) {
            console.warn(`Failed to fetch image ${url}: ${response.statusText}`);
            return null;
        }
        const blob = await response.blob();
        if (!blob.type.startsWith('image/')) {
            console.warn(`URL did not point to a valid image: ${url}`);
            return null;
        }
        
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                const dataUrl = reader.result as string;
                const base64Data = dataUrl.split(',')[1];
                if (base64Data) {
                    resolve({
                        inlineData: {
                            mimeType: blob.type,
                            data: base64Data,
                        },
                    });
                } else {
                    reject(new Error("Could not convert image blob to base64."));
                }
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.error(`Error processing image URL ${url}:`, error);
        return null;
    }
};


// --- SERPER API CALLER ---
type SerperOrganicResult = {
    title: string;
    link: string;
    snippet: string;
    priceRange?: string;
};

const callSerperApi = async (query: string): Promise<{ organic: SerperOrganicResult[] }> => {
    if (!SERPER_API_KEY) {
        throw new Error("SERPER_API_KEY environment variable is not set. Web search is disabled.");
    }
    try {
        // Using a CORS proxy to bypass browser security restrictions for client-side API calls.
        const response = await fetch('https://corsproxy.io/?https://google.serper.dev/search', {
            method: 'POST',
            headers: {
                'X-API-KEY': SERPER_API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ q: query, gl: 'uz', num: 10 }) // Geolocation set to Uzbekistan, fetch top 10 results
        });
        if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Serper API responded with status ${response.status}: ${errorBody}`);
        }
        const data = await response.json();
        return { organic: data.organic || [] };
    } catch (error) {
        console.error("Error calling Serper API:", error);
        throw new Error(`Failed to execute search via Serper. Details: ${error instanceof Error ? error.message : String(error)}`);
    }
};


// --- STAGE 1: DATA EXTRACTION ---
const extractionSchema = {
    type: Type.OBJECT,
    properties: {
        deadline: {
            type: Type.STRING,
            description: "The tender submission deadline date and time. Use 'YYYY-MM-DD HH:mm:ss' format. If not found, MUST be 'N/A'."
        },
        products: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    id: { type: Type.STRING, description: "A unique ID for this product, like positionNumber-name." },
                    itemType: { type: Type.STRING, description: "MUST be either 'PRODUCT' for tangible goods or 'SERVICE' for services like construction or repair." },
                    name: { type: Type.STRING, description: "The specific name of the product or service. This MUST be the result of the ULTIMATE PRODUCT NAME RULE if it's a PRODUCT." },
                    positionNumber: { type: Type.STRING, description: "The original position identifier from the document (e.g., '#1', '№ 5'). For a SERVICE, use 'N/A'." },
                    parentProductName: { type: Type.STRING, description: "If this is a sub-item from a complex position, this is the name of the main position. Otherwise, 'N/A'." },
                    ifxtCode: { type: Type.STRING, description: "The IFXT/MXIK code if available, otherwise 'N/A'." },
                    manufacturer: { type: Type.STRING, description: "Manufacturer name if specified, otherwise 'N/A'." },
                    features: { type: Type.STRING, description: "A DETAILED concatenation of all descriptions, characteristics, and technical requirements. If images are provided, you MUST append a visual description starting with 'Visual Description from Images:' to this field." },
                    dimensions: { type: Type.STRING, description: "Physical dimensions of the product (e.g., '120x60x75 cm') extracted from images or text. MUST be 'N/A' if not found." },
                    unit: { type: Type.STRING, description: "The unit of measurement (e.g., 'dona', 'шт.', 'комплект'). For a SERVICE, use 'xizmat' or 'услуга'." },
                    quantity: { type: Type.NUMBER, description: "The quantity required. For a SERVICE, use 1." },
                    startPrice: { type: Type.STRING, description: "The starting price from the document. YOU MUST INCLUDE THE CURRENCY if specified (e.g., '15 000 000 UZS', '1200 USD'). Otherwise 'N/A'." }
                },
                required: ["id", "itemType", "name", "positionNumber", "parentProductName", "ifxtCode", "manufacturer", "features", "dimensions", "unit", "quantity", "startPrice"]
            }
        }
    },
    required: ["deadline", "products"]
};


const getDataExtractionPrompt = (request: AnalysisRequest, knowledgeBaseContent?: string): string => {
    // Determine if a priority document (from a file) is present in the content
    const hasPriorityDocument = request.content?.includes('PRIORITY DOCUMENT') || request.content?.includes('USER UPLOADED DOCUMENT');
    const hasImages = request.images && request.images.length > 0;

    const knowledgeBaseInstruction = knowledgeBaseContent ? `
**INTERNAL KNOWLEDGE BASE (HIGHEST PRIORITY):**
You have access to structured data from our past signed contracts. You MUST use this data to improve the accuracy of your extraction. For example, if a product in the tender document matches one from a past contract, use the contract's detailed specifications to enrich the extracted fields.
---
${knowledgeBaseContent}
---
` : '';
    
    // The complex HTML-parsing instructions are ONLY included if there's no priority file content.
    const auctionInstructions = (request.tenderType === 'Auksion' && !hasPriorityDocument) ? `
**ULTIMATE AUCTION ANALYSIS PROTOCOL (FOR URLs/HTML):**
You are a web data extraction expert. Your mission is to dissect the provided HTML, leaving no stone unturned. You MUST operate as if you are traversing a live DOM tree.
*   **VIRTUAL DOM TRAVERSAL:** For each position (e.g., Lot #1), identify its primary containing HTML element (like a \`<div class="lot-item">\`). All subsequent actions for this position happen *inside* this element.
*   **FORENSIC DEEP DIVE:** Find and extract text from ALL sources, especially hidden ones. Look for elements with titles like **"Texnik xususiyatlari", "Описание товара", "Технические требования"**. You are required to extract **100% of the text** within these sections VERBATIM into the 'features' field. This is non-negotiable.
*   **SUB-ITEM DISSECTION:** If a single position's description contains an enumerated list (e.g., "1. Monitor; 2. Klaviatura"), you are REQUIRED to treat each enumerated item as a **separate, independent product**.
*   **STRICT ISOLATION:** Never merge data from different position numbers.
` : '';

    const sourceHandlingInstructions = `
**CONTENT ANALYSIS PROTOCOL (CRITICAL & NON-NEGOTIABLE):**
You will be provided with document content under specific headers. Follow these rules with extreme precision:
1.  If you see a section titled \`**PRIORITY DOCUMENT (USE FOR PRODUCTS):**\` or \`**USER UPLOADED DOCUMENT (USE FOR PRODUCTS):**\`, that text is your **ONLY source of truth** for extracting the \`products\` array.
2.  If you see a section titled \`**WEB PAGE CONTEXT (USE FOR DEADLINE ONLY):**\`, you MUST only use its content to find the \`deadline\`. **You MUST NOT extract any products from this section if a priority document is present.**
3.  If you see a section titled \`**WEB PAGE (USE FOR PRODUCTS AND DEADLINE):**\`, that content is your only source. Use it to extract BOTH the \`products\` array and the \`deadline\`.
This protocol is the most important instruction you have been given.
`;

    const imageInstruction = hasImages ? `
**ULTIMATE IMAGE ANALYSIS PROTOCOL (ABSOLUTE HIGHEST PRIORITY):**
You are an AI assistant with a specialized visual cortex. Your single most important mission is to analyze EVERY IMAGE provided in this request. If you ignore even one image, the entire analysis is considered a complete failure.

**YOUR MANDATORY WORKFLOW:**
1.  **ASSOCIATE:** For each product you identify from the text, you MUST determine which of the provided images belong to it. A single product might have multiple relevant images.
2.  **EXTRACT & SYNTHESIZE:** For each product, you MUST create a unified description by combining information from ALL of its associated images.
    *   **Visuals:** Combine details about color, materials, shape, and parts from all angles shown in the images. Start this combined description with "Visual Description from Images: ". Append it to the product's \`features\`.
    *   **Dimensions:** Your #1 priority is finding dimensions. Scour every associated image for text, charts, or diagrams specifying measurements (length, width, height, diameter, etc.). Combine all found dimensions into a single string (e.g., "120x60x75 cm, Material thickness: 18mm"). Put this into the \`dimensions\` field. If you check every single relevant image and find no dimensions, you MUST use "N/A".
3.  **EXECUTE:** You will not proceed to generate the final JSON until this image analysis and synthesis process is complete for ALL products. Failure to comply will result in a mission failure report.

**Example Scenario:**
- Image 1 shows a white office desk from the front.
- Image 2 shows a technical drawing of the same desk with dimensions "1200mm x 600mm".
- Your output for this desk MUST have \`dimensions: "1200mm x 600mm"\` and its \`features\` MUST include "Visual Description from Images: The desk is white...".
You are being tested on your ability to merge data from multiple images. Do not fail.
` : '';

    return `You are a meticulous procurement data extraction robot. Your SOLE task is to analyze the provided tender document, including any images, and extract ALL product positions and the lot deadline into a valid JSON object.
Your response MUST be a single, valid JSON object that strictly follows the provided schema. DO NOT output any other text, explanation, or markdown. Start your response directly with \`{\`.

${sourceHandlingInstructions}
${imageInstruction}

**MANDATORY THINKING & EXECUTION PROTOCOL:**
Before you generate the JSON, you MUST follow this internal thought process:
1.  **Step 1: Raw Data Ingestion.** Read the ENTIRETY of the provided content, obeying the CONTENT ANALYSIS PROTOCOL above. If analyzing a web page, perform the "ULTIMATE AUCTION ANALYSIS PROTOCOL".
2.  **Step 2: Structured Data Mapping.** Internally, map the raw data you collected to the required JSON fields (name, features, quantity, etc.).
3.  **Step 3: JSON Generation.** ONLY after completing Step 2 for ALL products, construct the final, single JSON object.

**PRIMARY OBJECTIVE: Classify and Extract**
Your first task is to determine if the tender is for **tangible goods** or a **service**.

**DEADLINE EXTRACTION (CRITICAL):**
You MUST find the tender submission deadline from the appropriate content source (as per the CONTENT ANALYSIS PROTOCOL). Look for terms like "Tugash sanasi", "Окончание приема заявок". Format as YYYY-MM-DD HH:mm:ss or "N/A".

**CURRENCY EXTRACTION RULE (CRITICAL):**
For any price field, you MUST extract the price value along with its currency symbol or code (e.g., UZS, СУМ, USD, $).

**SERVICE ANALYSIS PROTOCOL:**
If the tender is for a service (e.g., construction, repair):
1.  The \`products\` array MUST contain only ONE object.
2.  Set \`itemType\` to "SERVICE" and \`name\` to a short description.
3.  Set \`quantity\` to 1 and \`unit\` to "xizmat".
4.  All other fields like \`positionNumber\`, \`ifxtCode\` should be "N/A".

**GOODS ANALYSIS PROTOCOL:**
If the tender is for tangible goods:
1.  Set \`itemType\` for EVERY item to "PRODUCT".
2.  Apply the "ULTIMATE PRODUCT NAME RULE" and "CURRENCY EXTRACTION RULE" for each item.

**CRITICAL RULE ON MISSING DATA:** For every product you identify, you MUST create a complete JSON object. If a specific field's value cannot be found, you MUST use "N/A" for string fields and \`1\` for the numeric \`quantity\` field.

**ULTIMATE PRODUCT NAME RULE (Most Important Instruction):**
Your goal for the 'name' field is to create the most specific and searchable name possible. You MUST combine the Brand and Model if available (e.g., "Midea Brabus 12 Inverter"). This is CRITICAL for the web search step.

${knowledgeBaseInstruction}
**Tender Type:** ${request.tenderType}

${auctionInstructions}

**DOCUMENT CONTENT TO ANALYZE:**
---
${request.content}
---

Now, execute the protocol. Your final response must be ONLY the single, valid JSON object.`;
};


const extractData = async (request: AnalysisRequest, knowledgeBaseContent?: string): Promise<{ deadline: string; products: Omit<Product, 'suppliers'>[] }> => {
    const prompt = getDataExtractionPrompt(request, knowledgeBaseContent);
    
    const textPart = { text: prompt };
    const parts: (GenerativePart | { text: string })[] = [textPart];

    if (request.images && request.images.length > 0) {
        parts.push(...request.images);
    }

    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: { parts: parts },
        config: {
            responseMimeType: "application/json",
            responseSchema: extractionSchema
        }
    });
    if (!response.text) throw new Error("Data extraction returned an empty response.");

    const parsedResponse = safeJsonParse<{ deadline: string; products: Omit<Product, 'suppliers'>[] }>(response.text);

    if (!parsedResponse || !Array.isArray(parsedResponse.products)) {
        throw new Error("Failed to parse extracted data from AI response. The response may not be valid JSON.");
    }
    return parsedResponse;
};


// --- STAGE 2: SUPPLIER SEARCH (PER-PRODUCT) ---

// --- Schemas & Types ---
interface NormalizedProductNames {
    id: string;
    originalName: string;
    uzbekLatin: string;
    russianLatin: string;
    english: string;
}

const normalizationSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            originalName: { type: Type.STRING },
            uzbekLatin: { type: Type.STRING },
            russianLatin: { type: Type.STRING },
            english: { type: Type.STRING },
        },
        required: ["id", "originalName", "uzbekLatin", "russianLatin", "english"],
    }
};

const supplierSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            id: { type: Type.STRING },
            companyName: { type: Type.STRING },
            price: { type: Type.STRING, description: "The price of the product, including its currency (e.g., '1500000 UZS', '$120'). Should be 'N/A' if not found." },
            phone: { type: Type.STRING },
            website: { type: Type.STRING },
            region: { type: Type.STRING },
            address: { type: Type.STRING },
            stockStatus: { type: Type.STRING }
        },
        required: ["id", "companyName", "price", "phone", "website", "region", "address", "stockStatus"]
    }
};

interface SearchQueryBatch {
    [productId: string]: string[];
}

const batchSearchQueriesSchema = {
    type: Type.ARRAY,
    items: {
        type: Type.OBJECT,
        properties: {
            productId: { type: Type.STRING, description: "The unique ID of the product." },
            queries: {
                type: Type.ARRAY,
                description: "An array of 5 search query strings for the product.",
                items: { type: Type.STRING }
            }
        },
        required: ["productId", "queries"]
    }
};


// --- Multi-lingual Name Normalization ---
const normalizeProductNamesForSearch = async (products: { id: string, name: string }[]): Promise<NormalizedProductNames[]> => {
    if (products.length === 0) return [];
    
    const prompt = `You are a multilingual product normalization expert for the Uzbekistan e-commerce market. Your task is to take a list of product names, which may be in Russian Cyrillic or Uzbek Cyrillic, and generate multiple search-optimized variations for each.

Your response MUST be a single JSON array of objects, strictly following the provided schema. Do not add any extra formatting, explanations, or markdown.

**CRITICAL NORMALIZATION PROTOCOL:**

For EACH product in the input list, you MUST perform the following analysis:
1.  **IDENTIFY & PRESERVE CORE INFO:** You MUST identify and preserve any brand names (e.g., 'Midea', 'Artel'), model numbers (e.g., 'RTX 3060', '12000 BTU'), and technical specifications. This information is SACRED and must appear consistently across all generated variations.
2.  **GENERATE UZBEK LATIN (\`uzbekLatin\`):** Create the most natural and commonly used Uzbek Latin version of the name. This might involve translation of generic Russian terms or transliteration of Uzbek terms.
    *   Example 1: "Кондиционер Midea Brabus 12" -> "Konditsioner Midea Brabus 12"
    *   Example 2: "Стол офисный" (Russian) -> "Ofis stoli" (Uzbek)
3.  **GENERATE RUSSIAN LATIN (\`russianLatin\`):** Create a direct, phonetic transliteration of the original name, preserving the Russian word structure. This is crucial as many Uzbek websites use direct transliterations.
    *   Example 1: "Кондиционер Midea Brabus 12" -> "Konditsioner Midea Brabus 12"
    *   Example 2: "Стол офисный" -> "Stol ofisnyy"
4.  **GENERATE ENGLISH (\`english\`):** Provide a concise and accurate English translation of the product.
    *   Example 1: "Кондиционер Midea Brabus 12" -> "Midea Brabus 12 Air Conditioner"
    *   Example 2: "Стол офисный" -> "Office Desk"

**INPUT PRODUCTS:**
${JSON.stringify(products)}

**Example Output:**
[
  {
    "id": "prod-1",
    "originalName": "Кондиционер Midea Brabus 12",
    "uzbekLatin": "Konditsioner Midea Brabus 12",
    "russianLatin": "Konditsioner Midea Brabus 12",
    "english": "Midea Brabus 12 Air Conditioner"
  },
  {
    "id": "prod-2",
    "originalName": "Стол офисный",
    "uzbekLatin": "Ofis stoli",
    "russianLatin": "Stol ofisnyy",
    "english": "Office Desk"
  }
]

Now, execute the protocol. Your final response must be ONLY the single, valid JSON array.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: normalizationSchema,
            }
        });
        if (!response.text) return [];
        const parsedResponse = safeJsonParse<NormalizedProductNames[]>(response.text);
        return parsedResponse || [];
    } catch (error) {
        console.error("Batch name normalization failed:", error);
        // Fallback: simple transliteration for all
        return products.map(p => ({
            id: p.id,
            originalName: p.name,
            uzbekLatin: p.name, // Will be used as-is in latin
            russianLatin: p.name,
            english: p.name,
        }));
    }
};

// --- Batch Query Generation ---
const getSearchQueriesForMultipleProducts = async (
    products: {
        id: string;
        name: string;
        features: string;
        normalizedNames: NormalizedProductNames;
    }[]
): Promise<SearchQueryBatch> => {
    if (products.length === 0) return {};
    const prompt = `You are a search engine optimization expert specializing in procurement in Uzbekistan.
    Your PRIMARY GOAL is to generate search queries that find the *exact* product specified. To do this, you MUST prioritize technical specifications from the 'features' field.

    Based on the following list of products, generate a single JSON array of objects. Each object must contain a 'productId' (the product's 'id') and a 'queries' field, which is a JSON array of exactly 5 HIGHLY DIVERSE and effective Google search queries to find local suppliers.

    **CRITICAL INSTRUCTION: THE 'FEATURES' FIELD IS THE MOST IMPORTANT SOURCE OF TRUTH.**
    For EACH product, you MUST dissect its \`features\` field. This field contains the precise technical requirements from the tender document. Your queries MUST reflect these details.

    Follow this 5-query strategy for each product:
    1.  **Primary Uzbek Local Search:** Use the \`uzbekLatin\` name for a price check in a major city. (e.g., "Konditsioner Midea 12 narxi Toshkent")
    2.  **Russian Language Search:** Use the \`russianLatin\` name with a Russian purchase keyword. (e.g., "Кондиционер Midea 12 купить в Ташкенте")
    3.  **Technical Deep-Dive Search (Query 1 - CRITICAL):** Identify the most unique and searchable specification from \`features\` (like a model number, part number, or very specific dimension). Combine this with the product name. This is your highest priority query. (e.g., "Midea AF-12N8D6-I narxi")
    4.  **Technical Deep-Dive Search (Query 2 - CRITICAL):** Identify 2-3 other key specifications from \`features\` (e.g., "inverter", "12000 BTU", "R32 freon"). Combine these with the product name. (e.g., "Konditsioner 12000 BTU inverter R32 freon sotib olish")
    5.  **Broad Marketplace Search:** Use a slightly more generic version of the name to search on a popular local marketplace. (e.g., "Konditsioner Midea 12 olx.uz")

    **Product List:**
    ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, features: p.features, normalizedNames: p.normalizedNames })), null, 2)}

    **Example Output:**
    [
      {
        "productId": "prod-1",
        "queries": [
          "Konditsioner Midea Brabus 12 narxi Toshkent",
          "Konditsioner Midea Brabus 12 купить в Ташкенте",
          "Midea konditsioner AF-12N8D6-I narxi Uzbekistan",
          "Konditsioner Midea 12000 BTU inverter R32 freon sotib olish",
          "Konditsioner Midea Brabus 12 olx.uz"
        ]
      },
      {
        "productId": "prod-2",
        "queries": [
          "Ofis stoli narxi Toshkent",
          "Stol ofisnyy купить в Ташкенте",
          "Ofis stoli 120x60 sm narxi",
          "Ofis stoli oq LDSP sotib olish",
          "Ofis stoli olx.uz"
        ]
      }
    ]

    Your response MUST be ONLY a single, valid JSON array of objects that adheres to this structure.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: batchSearchQueriesSchema
            }
        });
        if (!response.text) return {};
        
        type QueryResponseItem = { productId: string; queries: string[] };
        const parsedResponse = safeJsonParse<QueryResponseItem[]>(response.text);
        if (!parsedResponse) return {};

        // Convert array back to the expected map/record format
        const result: SearchQueryBatch = {};
        for (const item of parsedResponse) {
            if (item.productId && Array.isArray(item.queries)) {
                result[item.productId] = item.queries;
            }
        }
        return result;

    } catch (error) {
        console.error(`Batch search query generation failed:`, error);
        // Fallback: return an object where each product gets a generic query
        const fallback: SearchQueryBatch = {};
        products.forEach(p => {
            fallback[p.id] = [`${p.normalizedNames.uzbekLatin} sotib olish O'zbekiston`];
        });
        return fallback;
    }
};


// --- Single-Product Supplier Analysis ---
const analyzeSearchResultsForProduct = async (
    product: Omit<Product, 'suppliers'>,
    searchResultsText: string,
    knowledgeBaseContent?: string
): Promise<Supplier[]> => {
    const knowledgeBaseData = knowledgeBaseContent ? `
**INTERNAL KNOWLEDGE BASE (Use for reference and verification):**
---
${knowledgeBaseContent}
---` : '';

    const prompt = `You are a meticulous procurement specialist with expertise in the Uzbek market. Your task is to analyze raw web search results for a SINGLE product and extract ONLY legitimate potential suppliers into a structured JSON array.
Your response MUST be ONLY a single, valid JSON array of supplier objects. Do not add any other text, explanation, or markdown. Start your response directly with \`[\`.

${knowledgeBaseData}

**PRODUCT TO ANALYZE:**
- Product ID: ${product.id}
- Product Name: ${product.name}
- Product Features: ${product.features}

**RAW SEARCH RESULTS for this product:**
${searchResultsText}

**MANDATORY EXTRACTION PROTOCOL:**

1.  **CRITICAL VETTING (Your Most Important Task):** You MUST act as a filter. For each search result, you MUST determine if it is a REAL commercial supplier.
    *   **EXTRACT FROM:** E-commerce sites (e.g., asaxiy.uz), company websites, official dealers, marketplaces (e.g., olx.uz, prom.uz), B2B portals.
    *   **STRICTLY IGNORE AND DISCARD:** Informational articles (Wikipedia, news sites), forums, blog posts, government portals (unless it's a direct e-shop), scientific papers, and any site that does not directly offer the product for sale or inquiry. **If you are unsure, DO NOT extract it.**

2.  **PRECISION DATA MAPPING:** For every VETTED supplier, you MUST map the data exactly as follows.
    - \`id\`: Generate a unique ID for this supplier entry, like 'supplier-' + a random number.
    - \`companyName\`: Extract from the "Title". Use the most specific company name possible. If the title is "Konditsioner sotib olish - OLX.uz", the company name should be "OLX.uz Seller" or a specific store name if visible in the snippet.
    - \`price\`: **CRITICAL CURRENCY RULE:** You MUST extract the price along with its currency. Scour the "Title", "Snippet", and "Price" fields for currency symbols ($, €, ₽) or codes (USD, EUR, RUB, UZS, СУМ). Your output MUST be a string like "1 200 000 UZS", "$150", "13500 RUB". If a price range is given, use the lower value. If no price is found at all, you MUST use the string "N/A". Do not invent a currency if one is not present.
    - \`phone\`: Find a valid phone number in the "Snippet". Look for Uzbek formats. If not present, you MUST use "N/A".
    - \`website\`: Use the exact value from the "Link" field.
    - \`region\`: If a city like "Toshkent", "Samarqand" is mentioned, use "UZ". Otherwise, assume "UZ" for domains ending in ".uz". If it's clearly international (e.g., aliexpress.com), use "International". Default to "UZ".
    - \`address\`: Extract a physical address from the "Snippet". If not present, use "N/A".
    - \`stockStatus\`: Analyze the "Snippet" for keywords. "в наличии", "складда мавжуд", "in stock" -> "In Stock". "под заказ" -> "On Order". If no status is mentioned, you MUST use "N/A".

3.  **NO SUPPLIERS FOUND:** If, after your critical vetting, NONE of the search results are valid suppliers, your response MUST be an empty JSON array: \`[]\`.

4.  **NO GUESSING:** Your reputation depends on accuracy. If information for a field is not present in the search result text, you MUST use "N/A". Do not infer or invent data.
`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: { type: Type.ARRAY, items: supplierSchema.items },
            }
        });
        if (!response.text) return [];
        const parsedSuppliers = safeJsonParse<Supplier[]>(response.text);
        return (parsedSuppliers || []).map(s => ({...s, id: s.id || `supplier-${Math.random()}`}));
    } catch (err) {
        console.warn(`Supplier analysis failed for product ID: ${product.id}. Continuing...`, err);
        return [];
    }
};

/**
 * Finds suppliers for multiple products by robustly processing each one individually
 * to ensure that a failure for one product does not affect others.
 */
const findSuppliersForProducts = async (
    products: Omit<Product, 'suppliers'>[],
    knowledgeBaseContent?: string,
    onProgress?: (progress: { current: number, total: number }) => void
): Promise<Product[]> => {
    const finalProducts: Product[] = [];
    let processedCount = 0;

    const productsToProcess = products.filter(p => p.name && p.name.trim() !== 'N/A');
    // If no products are valid, return the original list with empty suppliers
    if (productsToProcess.length === 0) {
        if (onProgress) {
            // Ensure progress bar completes
            onProgress({ current: products.length, total: products.length });
        }
        return products.map(p => ({ ...p, suppliers: [] }));
    }

    // --- BATCH OPERATIONS ---
    // STEP 1: Normalize all product names at once.
    const normalizedNamesList = await normalizeProductNamesForSearch(
        productsToProcess.map(p => ({ id: p.id, name: p.name }))
    );
    const normalizedNamesMap = new Map(normalizedNamesList.map(n => [n.id, n]));
    
    // Add a delay to respect rate limits between different types of batch calls.
    await new Promise(resolve => setTimeout(resolve, 4100));

    // STEP 2: Generate search queries for all products at once.
    const productsForQueryGen = productsToProcess.map(p => ({
        id: p.id,
        name: p.name,
        features: p.features,
        normalizedNames: normalizedNamesMap.get(p.id)! // '!' is safe since we built from productsToProcess
    }));
    const searchQueriesByProduct = await getSearchQueriesForMultipleProducts(productsForQueryGen);


    // --- SEQUENTIAL PROCESSING (Search + Analysis) ---
    for (const product of products) {
        // Handle products that were filtered out earlier by pushing them with empty suppliers
        if (!productsToProcess.some(p => p.id === product.id)) {
            finalProducts.push({ ...product, suppliers: [] });
            processedCount++;
            if (onProgress) onProgress({ current: processedCount, total: products.length });
            continue;
        }

        let foundSuppliers: Supplier[] = [];
        try {
            // Get pre-generated queries
            let queries = searchQueriesByProduct[product.id] || [];

            // Fallback query if AI-based query generation fails
            if (queries.length === 0) {
                const normalizedNames = normalizedNamesMap.get(product.id);
                const fallbackName = normalizedNames ? normalizedNames.uzbekLatin : product.name;
                queries.push(`${fallbackName} narxi O'zbekiston`);
                queries.push(`${fallbackName} купить в Ташкенте`);
            }

            // Execute Web Searches (Serper API, not a Gemini call)
            const searchPromises = queries.map(q => callSerperApi(q));
            const settledResults = await Promise.allSettled(searchPromises);

            const aggregatedResults: SerperOrganicResult[] = settledResults.flatMap(res => 
                res.status === 'fulfilled' && res.value.organic ? res.value.organic : []
            );

            // Deduplicate results
            const uniqueLinks = new Map<string, SerperOrganicResult>();
            aggregatedResults.forEach(item => {
                if (item.link && !uniqueLinks.has(item.link)) {
                    uniqueLinks.set(item.link, item);
                }
            });
            const uniqueResults = Array.from(uniqueLinks.values());

            // STEP 3 (per product): Analyze Search Results
            if (uniqueResults.length > 0) {
                const searchResultsText = uniqueResults
                    .map((r, index) => `[SEARCH RESULT ${index + 1}]\nTitle: ${r.title}\nLink: ${r.link}\n${r.priceRange ? `Price: ${r.priceRange}\n` : ''}Snippet: ${r.snippet}\n[END SEARCH RESULT ${index + 1}]`)
                    .join('\n\n');
                
                // Add a delay BEFORE the main Gemini call inside the loop.
                // This delay separates the `analyzeSearchResultsForProduct` calls from each other.
                await new Promise(resolve => setTimeout(resolve, 4100));

                foundSuppliers = await analyzeSearchResultsForProduct(product, searchResultsText, knowledgeBaseContent);
            }
            
            finalProducts.push({ ...product, suppliers: foundSuppliers });

        } catch (error) {
            console.error(`Failed to process product ${product.id} ("${product.name}"):`, error);
            finalProducts.push({ ...product, suppliers: [] });
        } finally {
            processedCount++;
            if (onProgress) onProgress({ current: processedCount, total: products.length });
            // The main delay is now *before* the API call inside the loop, so no extra delay is needed here.
        }
    }
    
    // Sort finalProducts to match the original order
    const productOrderMap = new Map(products.map((p, i) => [p.id, i]));
    finalProducts.sort((a, b) => (productOrderMap.get(a.id) ?? 0) - (productOrderMap.get(b.id) ?? 0));

    return finalProducts;
};


/**
 * Re-searches suppliers for a single, potentially modified, product.
 */
export const researchSingleProduct = async (
    product: Product,
    knowledgeBaseContent?: string
): Promise<Product> => {
    // The findSuppliersForProducts function expects an array, so we wrap our single product.
    const productsWithSuppliers = await findSuppliersForProducts([product], knowledgeBaseContent);
    if (productsWithSuppliers.length === 0) {
        throw new Error("Re-search failed to produce a result for the product.");
    }
    // Return the first (and only) product from the results array.
    return productsWithSuppliers[0];
};

// --- STAGE 3: SUMMARY GENERATION ---
const getSummaryPrompt = (products: Product[], request: AnalysisRequest): string => {
    const targetLanguage = languageMap[request.uiLanguage];
    const data = JSON.stringify(products.map(p => ({
        name: p.name,
        quantity: p.quantity,
        startPrice: p.startPrice,
        foundSuppliers: p.suppliers.length,
        // FIX: Use getUzsPrice for reliable price conversion, especially for price objects.
        bestPrice: p.suppliers.length > 0 ? Math.min(...p.suppliers.map(s => getUzsPrice(s.price))) : 'N/A'
    })), null, 2);

    return `You are an expert procurement analyst.
Based on the following analysis data, write a concise, 2-3 sentence expert summary.
Highlight the best value, potential risks (e.g., no suppliers found, high prices), and an overall recommendation.
**This summary MUST be written in ${targetLanguage}.**

**Analysis Data:**
${data}

Your response must be ONLY the summary text.`;
};

const generateSummary = async (products: Product[], request: AnalysisRequest): Promise<string> => {
    if (products.length === 0) return "No products were found in the document to summarize.";
    const prompt = getSummaryPrompt(products, request);
    const response = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt });
    return response.text || "Summary could not be generated.";
};


// --- STAGE 4: POTENTIAL SCORE CALCULATION ---
const calculatePotentialScore = (products: Product[], deadline: string): PotentialScore => {
    let totalOpportunity = 0;
    let totalRisk = 0;
    let totalStartPriceUzs = 0;
    let totalBestPriceUzs = 0;
    const productCount = products.length;

    if (productCount === 0) {
        return { opportunity: 0, risk: 100, winProbability: 0, potentialScore: 0, daysRemaining: -1 };
    }

    products.forEach(product => {
        let opportunityScore = 50;
        let riskScore = 10;
        
        const startPriceUzs = getUzsPrice(product.startPrice || 'N/A');
        const bestPriceUzs = product.suppliers.length > 0
            ? Math.min(...product.suppliers.map(s => getUzsPrice(s.price)))
            : Infinity;

        if (startPriceUzs !== Infinity) totalStartPriceUzs += startPriceUzs * product.quantity;
        if (bestPriceUzs !== Infinity) totalBestPriceUzs += bestPriceUzs * product.quantity;

        // Opportunity calculation
        if (product.suppliers.length > 0) {
            opportunityScore += 15;
            const bestSupplier = product.suppliers.reduce((best, current) => getUzsPrice(current.price) < getUzsPrice(best.price) ? current : best, product.suppliers[0]);
            if (String(bestSupplier.stockStatus).toLowerCase() === 'in stock') opportunityScore += 15;
            if (bestSupplier.region === 'UZ') opportunityScore += 10;
        }
        if (startPriceUzs !== Infinity && bestPriceUzs < startPriceUzs) {
            const advantage = (startPriceUzs - bestPriceUzs) / startPriceUzs;
            opportunityScore += Math.min(advantage * 50, 25);
        }
        
        // Risk calculation
        if (product.suppliers.length === 0) {
            riskScore += 40;
        } else {
            if (startPriceUzs !== Infinity && bestPriceUzs > startPriceUzs) {
                const disadvantage = (bestPriceUzs - startPriceUzs) / startPriceUzs;
                riskScore += Math.min(disadvantage * 50, 25);
            }
            const allOutOfStock = product.suppliers.every(s => String(s.stockStatus).toLowerCase() === 'out of stock');
            if (allOutOfStock) riskScore += 15;

            const allInternational = product.suppliers.every(s => s.region !== 'UZ');
            if(allInternational) riskScore += 10;
        }
        
        totalOpportunity += Math.min(100, opportunityScore);
        totalRisk += Math.min(100, riskScore);
    });

    const avgOpportunity = Math.round(totalOpportunity / productCount);
    const avgRisk = Math.round(totalRisk / productCount);

    const priceAdvantage = (totalStartPriceUzs > 0 && totalBestPriceUzs > 0 && totalBestPriceUzs < totalStartPriceUzs)
        ? (totalStartPriceUzs - totalBestPriceUzs) / totalStartPriceUzs
        : 0;
    
    const winProbability = parseFloat((priceAdvantage * 10).toFixed(2));
    const potentialScore = Math.round((avgOpportunity * 0.7) + ((100 - avgRisk) * 0.3));

    let daysRemaining = -1;
    if (deadline && deadline !== 'N/A') {
        try {
            const deadlineDate = new Date(deadline.replace(' ', 'T')); // Make it ISO compatible
            const now = new Date();
            const diffTime = deadlineDate.getTime() - now.getTime();
            daysRemaining = diffTime > 0 ? Math.ceil(diffTime / (1000 * 60 * 60 * 24)) : 0;
        } catch(e) {
            console.error("Could not parse deadline date:", deadline, e);
        }
    }
    
    return {
        opportunity: avgOpportunity,
        risk: avgRisk,
        winProbability: winProbability,
        potentialScore: potentialScore,
        daysRemaining: daysRemaining
    };
}


// --- DETAILED CONTRACT ANALYSIS ---
const contractDetailsSchema = {
    type: Type.OBJECT,
    properties: {
        customer: { type: Type.STRING, description: "The name of the party receiving the goods/services (the buyer, заказчик, xaridor)." },
        supplier: { type: Type.STRING, description: "The name of the party providing the goods/services (the seller, поставщик, yetkazib beruvchi)." },
        totalValue: { type: Type.STRING, description: "The total monetary value of the contract, including currency (e.g., '150 000 000 UZS'). If not found, 'N/A'." },
        products: {
            type: Type.ARRAY,
            description: "A list of all products or services specified in the contract.",
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: "The name of the product or service." },
                    quantity: { type: Type.NUMBER, description: "The quantity of the product." },
                    unitPrice: { type: Type.STRING, description: "The price per unit of the product, including currency." },
                },
                required: ["name", "quantity", "unitPrice"]
            }
        }
    },
    required: ["customer", "supplier", "totalValue", "products"]
};

export const analyzeContract = async (contractContent: string): Promise<ContractDetails> => {
    if (!contractContent.trim()) {
        throw new Error("Contract content is empty.");
    }
    const prompt = `You are a highly-specialized contract analysis AI. Your task is to extract structured data from the provided contract text.
You MUST identify the key entities and the complete list of goods/services.
Your response MUST be a single, valid JSON object that strictly adheres to the provided schema. Do not output any other text, explanation, or markdown. Start your response directly with \`{\`.

**Contract Text:**
---
${contractContent}
---

Now, execute the analysis and provide the structured JSON output.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: contractDetailsSchema
            }
        });
        if (!response.text) throw new Error("Contract analysis returned an empty response.");
        
        const parsedDetails = safeJsonParse<ContractDetails>(response.text);
        if (!parsedDetails) throw new Error("Failed to parse structured contract details from AI response.");

        return parsedDetails;
    } catch (error) {
        console.error("Error analyzing contract:", error);
        throw new Error(`AI analysis of the contract failed. Details: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// --- STAGE 5: BID RECOMMENDATION ---
const bidRecommendationSchema = {
    type: Type.OBJECT,
    properties: {
        recommendedBid: { type: Type.NUMBER },
        justification: { type: Type.STRING },
        competitorAnalysis: { type: Type.STRING },
        costBreakdown: {
            type: Type.OBJECT,
            properties: {
                goodsTotal: { type: Type.NUMBER },
                logisticsCost: { type: Type.NUMBER },
                bankGuaranteeCost: { type: Type.NUMBER },
                commissionCost: { type: Type.NUMBER },
                fixedCosts: { type: Type.NUMBER },
                subtotal: { type: Type.NUMBER },
                profitMargin: { type: Type.NUMBER },
                total: { type: Type.NUMBER }
            },
            required: ["goodsTotal", "logisticsCost", "bankGuaranteeCost", "commissionCost", "fixedCosts", "subtotal", "profitMargin", "total"]
        }
    },
    required: ["recommendedBid", "justification", "competitorAnalysis", "costBreakdown"]
};


export const getBidRecommendation = async (
    selectedProducts: { product: Product, supplier: Supplier }[],
    costs: AdditionalCosts,
    tenderContent: string | undefined,
    language: 'uz' | 'uz-Cyrl' | 'ru'
): Promise<BidRecommendation> => {

    const targetLanguage = languageMap[language];

    const prompt = `You are an expert procurement specialist and broker for the Uzbek market. Your goal is to propose a winning bid for a tender. In Uzbek tenders, the lowest valid bid typically wins. You must be strategic.

**Analysis Task:**
1.  **Calculate Break-Even Point:** Based on the provided supplier prices and additional absolute costs, calculate the total cost price (subtotal).
2.  **Estimate Competitor Bids:** Analyze the original tender document context to estimate the likely price range of competitors. Consider the product value, market saturation, and typical margins in Uzbekistan.
3.  **Recommend a Strategic Bid:** Propose a final bid price. This price should be as low as possible to win but MUST include the specified profit margin. The final recommended bid is calculated based on the total cost price (subtotal) and the desired profit margin percentage. However, your justification should explain why this price is competitive.
4.  **Provide Justification:** Explain your reasoning in a few sentences.

**Input Data:**

*   **Selected Products & Supplier Prices (in UZS):**
    ${selectedProducts.map(item => `    - ${item.product.name} (x${item.product.quantity}): ${getUzsPrice(item.supplier.price) * item.product.quantity} UZS`).join('\n')}

*   **Additional Costs & Margin (in UZS):**
    - Logistics Costs: ${costs.logisticsCost} UZS
    - Bank Guarantee Costs: ${costs.bankGuaranteeCost} UZS
    - Broker Commission: ${costs.commissionCost} UZS
    - Fixed Overhead Costs: ${costs.fixedCosts} UZS
    - Desired Profit Margin: ${costs.profitMarginPercent}% on top of total cost (subtotal)

*   **Original Tender Document Context:**
    ---
    ${tenderContent || "No additional context provided. Base your analysis on the product list."}
    ---

**Output Requirement:**
Your response MUST be a single, valid JSON object that adheres to the provided schema. The language for 'justification' and 'competitorAnalysis' fields must be **${targetLanguage}**. All monetary values must be in UZS. Do not output any other text or markdown.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: bidRecommendationSchema
            }
        });
        if (!response.text) throw new Error("Bid recommendation returned an empty response.");

        const parsedRecommendation = safeJsonParse<BidRecommendation>(response.text);
        if (!parsedRecommendation) throw new Error("Failed to parse bid recommendation from AI response.");

        return parsedRecommendation;

    } catch (error) {
        console.error("Error getting bid recommendation:", error);
        throw new Error(`AI failed to generate a bid recommendation. Details: ${error instanceof Error ? error.message : String(error)}`);
    }

};

// --- QUICK SEARCH FEATURE ---

const extractDetailsFromHtml = async (html: string, originalQuery: string, pageTitle: string): Promise<{ price: string | null; phone: string | null; }> => {
    const detailsExtractionSchema = {
        type: Type.OBJECT,
        properties: {
            price: {
                type: Type.STRING,
                description: "The extracted price including currency (e.g., '15 000 000 UZS'). MUST be 'N/A' if not found."
            },
            phone: {
                type: Type.STRING,
                description: "The first valid contact phone number found on the page, preferably in Uzbek format (e.g., +998 XX XXX XX XX). MUST be 'N/A' if not found."
            }
        },
        required: ["price", "phone"]
    };

    const prompt = `You are a highly advanced web data extraction AI specializing in Uzbek e-commerce sites. Your sole mission is to find the exact price and a contact phone number for a specific product within the provided HTML.

**CONTEXT:**
- User's Original Search Query: "${originalQuery}"
- Web Page Title: "${pageTitle}"

**ULTIMATE DETAILS EXTRACTION PROTOCOL (CRITICAL):**
Follow these steps meticulously:
1.  **IDENTIFY THE MAIN PRODUCT:** The price you extract MUST belong to the product that most closely matches the user's query and the page title. Viciously ignore prices in sections like "You may also like," "Recommended products," or for accessories.
2.  **FORENSIC PRICE SCAN:** Scrutinize the HTML for the price. Look for:
    *   Common class names: \`price\`, \`product-price\`, \`product__price\`, \`price-new\`, \`current-price\`, \`cost\`.
    *   Uzbek/Russian keywords located NEAR a number: "narxi", "narx", "цена", "стоимость".
    *   HTML tags that often contain prices: \`<span>\`, \`<strong>\`, \`<p>\`, \`<bdi>\`.
3.  **DISCOUNT & SALE PRICE LOGIC:** If you see a "slashed-out" old price and a new, current price, you MUST extract the **new/current price**.
4.  **CURRENCY IS MANDATORY:** You MUST extract the full price, including the currency. Common currencies in Uzbekistan are "UZS", "so'm", "сўм", "СУМ". If you find a number but no currency, look for it in nearby elements. If no currency can be found anywhere, assume UZS but it's better to find it.
5.  **NO PRICE FOUND = "N/A":** If, after your thorough analysis, you cannot find a clear, unambiguous price for the main product, your response for the 'price' field MUST be the string "N/A". Do not guess or calculate. If the price is "By agreement" ("Келишилган" or "Договорная"), use "N/A".
6.  **PHONE NUMBER HUNT:** Scour the entire HTML for a contact phone number. Prioritize numbers in headers, footers, or "Контакты" sections. Look for Uzbek formats like +998 XX XXX-XX-XX. Format it cleanly. If multiple numbers exist, extract the first valid one you find. If none are found, the 'phone' field MUST be "N/A".

**HTML CONTENT TO ANALYZE (first 50000 characters):**
---
${html.substring(0, 50000)}
---

Your response MUST be ONLY a single, valid JSON object that strictly follows the provided schema. Do not output anything else.`;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: detailsExtractionSchema,
            }
        });
        if (!response.text) return { price: null, phone: null };

        const parsed = safeJsonParse<{ price: string; phone: string }>(response.text);
        return {
            price: (parsed && parsed.price !== 'N/A') ? parsed.price : null,
            phone: (parsed && parsed.phone !== 'N/A') ? parsed.phone : null
        };
    } catch (err) {
        console.error("Error during detail extraction:", err);
        return { price: 'Analysis Error', phone: 'Analysis Error' };
    }
}

export const performQuickSearch = async (query: string): Promise<QuickSearchResult[]> => {
    const serperResults = await callSerperApi(query);
    const initialResults = serperResults.organic.slice(0, 10);

    const detailExtractionPromises = initialResults.map(async (result) => {
        try {
            const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(result.link)}`;
            const pageResponse = await fetch(proxiedUrl);
            if (!pageResponse.ok) {
                return { ...result, id: result.link, price: 'Fetch Failed', phone: 'Fetch Failed' };
            }
            const htmlContent = await pageResponse.text();

            const details = await extractDetailsFromHtml(htmlContent, query, result.title);
            return { ...result, id: result.link, price: details.price, phone: details.phone };

        } catch (error) {
            console.error(`Failed to process link ${result.link}:`, error);
            return { ...result, id: result.link, price: 'Analysis Failed', phone: 'Analysis Failed' };
        }
    });

    const finalResults = await Promise.all(detailExtractionPromises);
    return finalResults;
};


// --- ORCHESTRATOR ---
export const analyzeLot = async (
    request: AnalysisRequest,
    onProgress: (progress: AnalysisProgress) => void,
    knowledgeBaseContent?: string
): Promise<AnalysisResult> => {
    try {
        if (!request.content && !request.url) {
            throw new Error("Analysis requires either file content or a URL.");
        }

        let contentForPrompt = '';
        let fullContentForHistory = '';
        let allImageParts: GenerativePart[] = request.images || [];

        const userUploadedContent = request.content || '';
        let fetchedFileContent = '';
        let fetchedHtmlContent = '';

        // --- DEEP SCRAPING FOR UZEX AUCTIONS ---
        if (request.platform === TenderPlatform.UZEX && request.tenderType === TenderType.AUCTION && request.url) {
            onProgress({ stage: 'scraping', current: 0, total: 1 });
            console.log("Starting deep scrape for xarid.uzex.uz auction...");
            try {
                const proxiedPageUrl = `https://corsproxy.io/?${encodeURIComponent(request.url)}`;
                const pageResponse = await fetch(proxiedPageUrl);
                if (pageResponse.ok) {
                    fetchedHtmlContent = await pageResponse.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(fetchedHtmlContent, 'text/html');
                    const baseUrl = request.url;
                    
                    const techSpecKeywords = ['texnik topshiriq', 'техническое задание', 'спецификация'];
                    const foundImageUrls = new Set<string>();

                    // 1. Find images on the main page
                    doc.querySelectorAll('img').forEach(img => {
                        const src = img.getAttribute('src');
                        if (src) {
                            try {
                                foundImageUrls.add(new URL(src, baseUrl).href);
                            } catch (e) { console.warn("Invalid image URL found:", src); }
                        }
                    });
                    
                    // 2. Find links and scrape images from them
                    const pageLinks = new Set<string>();
                    doc.querySelectorAll('a').forEach(link => {
                        const href = link.getAttribute('href');
                        if (href) {
                            try {
                                const absoluteUrl = new URL(href, baseUrl).href;
                                const linkText = link.textContent?.trim().toLowerCase() || '';
                                const isExternal = new URL(absoluteUrl).hostname !== new URL(baseUrl).hostname;
                                if ((techSpecKeywords.some(keyword => linkText.includes(keyword)) || isExternal) && !absoluteUrl.match(/\.(pdf|docx|zip|xls|xlsx)$/i)) {
                                   pageLinks.add(absoluteUrl);
                                }
                            } catch (e) { /* ignore invalid links */ }
                        }
                    });

                    // Scrape linked pages (limit to first 2)
                    for (const linkUrl of Array.from(pageLinks).slice(0, 2)) {
                        try {
                            const linkedPageResponse = await fetch(`https://corsproxy.io/?${encodeURIComponent(linkUrl)}`);
                            if (linkedPageResponse.ok) {
                                const linkedHtml = await linkedPageResponse.text();
                                const linkedDoc = parser.parseFromString(linkedHtml, 'text/html');
                                linkedDoc.querySelectorAll('img').forEach(img => {
                                    const src = img.getAttribute('src');
                                    if (src) {
                                        try {
                                            foundImageUrls.add(new URL(src, linkUrl).href);
                                        } catch (e) { /* ignore */ }
                                    }
                                });
                            }
                        } catch (e) { console.warn(`Could not scrape linked page: ${linkUrl}`, e); }
                    }

                    // 3. Fetch all unique images
                    const imagePromises = Array.from(foundImageUrls).map(imageUrlToGenerativePart);
                    const settledImageResults = await Promise.allSettled(imagePromises);
                    const scrapedImages = settledImageResults
                        .filter(res => res.status === 'fulfilled' && res.value)
                        .map(res => (res as PromiseFulfilledResult<GenerativePart>).value);
                    
                    allImageParts = [...allImageParts, ...scrapedImages];
                    console.log(`Deep scrape complete. Found ${scrapedImages.length} additional images.`);

                    // 4. Find the technical specification file link (existing logic)
                    let techSpecFileUrl: string | null = null;
                    const directLinks = Array.from(doc.querySelectorAll('a'));
                    for (const link of directLinks) {
                        const linkText = link.textContent?.trim().toLowerCase() || '';
                        if (techSpecKeywords.some(keyword => linkText.includes(keyword))) {
                            const href = link.getAttribute('href');
                            if (href && href.match(/\.(pdf|docx|xls|xlsx)$/i)) {
                                techSpecFileUrl = new URL(href, request.url).href;
                                break;
                            }
                        }
                    }
                    if (techSpecFileUrl) {
                        fetchedFileContent = await fetchAndExtractFile(techSpecFileUrl);
                    }
                }
            } catch (e) {
                console.error("Failed to auto-fetch or deep scrape from uzex.uz, proceeding with provided data.", e);
            }
             onProgress({ stage: 'scraping', current: 1, total: 1 });
        } else if (request.url) {
             try {
                const proxiedPageUrl = `https://corsproxy.io/?${encodeURIComponent(request.url)}`;
                const pageResponse = await fetch(proxiedPageUrl);
                if (pageResponse.ok) { fetchedHtmlContent = await pageResponse.text(); }
             } catch (e) { console.error(`Failed to fetch URL ${request.url}`, e); }
        }
        
        // --- PROMPT & HISTORY CONTENT ASSEMBLY ---
        const primaryProductSource = fetchedFileContent || userUploadedContent;

        if (primaryProductSource) {
            const fileHeader = fetchedFileContent 
                ? '**PRIORITY DOCUMENT (USE FOR PRODUCTS):**\n' 
                : '**USER UPLOADED DOCUMENT (USE FOR PRODUCTS):**\n';
            contentForPrompt = `${fileHeader}${primaryProductSource}`;
            if (fetchedHtmlContent) {
                contentForPrompt += `\n\n**WEB PAGE CONTEXT (USE FOR DEADLINE ONLY):**\n${fetchedHtmlContent}`;
            }
        } else if (fetchedHtmlContent) {
            contentForPrompt = `**WEB PAGE (USE FOR PRODUCTS AND DEADLINE):**\n${fetchedHtmlContent}`;
        } else if (userUploadedContent) {
            contentForPrompt = `**USER UPLOADED DOCUMENT (USE FOR PRODUCTS):**\n${userUploadedContent}`;
        } else {
            throw new Error("No content could be loaded for analysis.");
        }
        fullContentForHistory = contentForPrompt;

        const enrichedRequest = { ...request, content: contentForPrompt.trim(), images: allImageParts };

        // STAGE 1: Extract Data (Products & Deadline)
        onProgress({ stage: 'extracting', current: 0, total: 1 });
        const { deadline, products: extractedProducts } = await extractData(enrichedRequest, knowledgeBaseContent);
        if (extractedProducts.length === 0) throw new Error("No products could be extracted from the document.");
        onProgress({ stage: 'extracting', current: 1, total: 1 });
        
        const isServiceLot = extractedProducts.length === 1 && extractedProducts[0].itemType === 'SERVICE';

        if (isServiceLot) {
            onProgress({ stage: 'summarizing', current: 0, total: 1 });
            const serviceItem = extractedProducts[0];
            const startPrice = serviceItem.startPrice || '0';
            const priceNumber = parseFloat(startPrice.replace(/[^0-9,.-]+/g, '').replace(',', '.'));
            
            let summary = '';
            if (!isNaN(priceNumber) && priceNumber > 0) {
                const estimatedPrice = priceNumber * 0.75;
                const formattedEstimatedPrice = new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'UZS', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(estimatedPrice);
                const summaryPrompts = {
                    'uz': `Ushbu lot xizmat ko'rsatish uchun mo'ljallangan (masalan, qurilish yoki ta'mirlash). Bozor narxini aniq belgilashning imkoni yo'q. Lotning boshlang'ich narxidan kelib chiqib, tavsiya etilgan taxminiy byudjet narxi (75%) ${formattedEstimatedPrice} ni tashkil etadi.`,
                    'uz-Cyrl': `Ушбу лот хизмат кўрсатиш учун мўлжалланган (масалан, қурилиш ёки таъмирлаш). Бозор нархини аниқ белгилашнинг имкони йўқ. Лотнинг бошланғич нархидан келиб чиқиб, тавсия этилган тахминий бюджет нархи (75%) ${formattedEstimatedPrice} ни ташкил этади.`,
                    'ru': `Этот лот представляет собой оказание услуг (например, строительство или ремонт). Точную рыночную цену определить невозможно. Исходя из стартовой цены лота, рекомендуемая оценочная бюджетная стоимость (75%) составляет ${formattedEstimatedPrice}.`
                };
                summary = summaryPrompts[request.uiLanguage];
            } else {
                 const summaryPrompts = {
                    'uz': `Ushbu lot xizmat ko'rsatish uchun mo'ljallangan. Boshlang'ich narx topilmadi, shuning uchun taxminiy byudjetni hisoblashning imkoni yo'q.`,
                    'uz-Cyrl': `Ушбу лот хизмат кўрсатиш учун мўлжалланган. Бошланғич нарх топилмади, шунинг учун тахминий бюджетни ҳисоблашнинг имкони йўқ.`,
                    'ru': `Этот лот представляет собой оказание услуг. Стартовая цена не найдена, поэтому рассчитать оценочный бюджет невозможно.`
                };
                summary = summaryPrompts[request.uiLanguage];
            }

            const productsWithEmptySuppliers = extractedProducts.map(p => ({ ...p, suppliers: [] }));
            const potentialScoreData = calculatePotentialScore(productsWithEmptySuppliers, deadline);

            const finalResult: AnalysisResult = {
                lotId: `lot-${Date.now()}`,
                analysisSummary: summary,
                products: productsWithEmptySuppliers,
                sourceIdentifier: request.url || request.fileName || 'Uploaded Content',
                deadline,
                potentialScoreData,
                tenderContent: fullContentForHistory,
            };

            onProgress({ stage: 'done', current: 1, total: 1 });
            console.log("Service-based lot analysis complete.");
            return finalResult;
        }

        // Add a delay before starting the supplier search stage to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 4100));
        
        // STAGE 2: Find Suppliers
        onProgress({ stage: 'searching', current: 0, total: extractedProducts.length });
        const onSearchProgress = (p: { current: number, total: number }) => {
             // Since findSuppliersForProducts is now used for single re-searches, 
             // its internal total will be different. We use the original total.
            onProgress({ stage: 'searching', current: p.current, total: extractedProducts.length });
        };
        const productsWithSuppliers = await findSuppliersForProducts(extractedProducts, knowledgeBaseContent, onSearchProgress);


        // STAGE 3: Generate Final Summary
        onProgress({ stage: 'summarizing', current: 0, total: 1 });
        // Add a delay before the final summary call to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 4100));
        const summary = await generateSummary(productsWithSuppliers, request);
        onProgress({ stage: 'summarizing', current: 1, total: 1 });
        
        // STAGE 4: Calculate Potential Score
        const potentialScoreData = calculatePotentialScore(productsWithSuppliers, deadline);

        const finalResult: AnalysisResult = {
            lotId: `lot-${Date.now()}`,
            analysisSummary: summary,
            products: productsWithSuppliers,
            sourceIdentifier: request.url || request.fileName || 'Uploaded Content',
            deadline,
            potentialScoreData,
            tenderContent: fullContentForHistory, // Pass the full content for bid calculation context
        };

        onProgress({ stage: 'done', current: 1, total: 1 });
        console.log("Multi-stage analysis complete with chunked batch processing.");
        return finalResult;

    } catch (e) {
        console.error("Error during multi-stage analysis:", e);
        throw new Error(`Failed to process the request. (Details: ${e instanceof Error ? e.message : String(e)})`);
    }
};