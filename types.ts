

export enum TenderPlatform {
  UZEX = 'xarid.uzex.uz',
  XT = 'xt-xarid.uz',
}

export enum TenderType {
  AUCTION = 'Auksion',
  SELECTION = 'Eng yaxshi takliflarni tanlash (Otbor)',
  ESHOP = 'Elektron do\'kon',
}

export type AnalysisStage = 'scraping' | 'extracting' | 'searching' | 'summarizing' | 'done';

export interface AnalysisProgress {
  stage: AnalysisStage;
  current: number;
  total: number;
}

// NEW: Interface for AI generative parts (like images)
export interface GenerativePart {
  inlineData: {
    mimeType: string;
    data: string;
  };
}

export interface AnalysisRequest {
  platform: TenderPlatform;
  tenderType: TenderType;
  url?: string; // URL string (optional)
  content?: string; // Full text content from a file (optional)
  fileName?: string; // Original filename for display
  images?: GenerativePart[]; // Optional array of image parts
  uiLanguage: 'uz' | 'uz-Cyrl' | 'ru'; // Language for the AI summary
}

export interface Supplier {
  companyName: string;
  price: string | { amount: number | string; currency: string };
  phone: string;
  website: string;
  region: 'UZ' | 'International';
  address: string;
  stockStatus: string; // e.g., 'In Stock', 'On Order', 'Out of Stock', 'N/A'
  score?: number; // Optional score, calculated on the frontend
  id: string; // Unique ID for a supplier within a product
}

export interface Product {
  id: string;
  name: string;
  ifxtCode: string;
  manufacturer: string;
  features: string;
  dimensions?: string; // NEW: To hold dimensions extracted from images or text
  unit: string;
  quantity: number;
  startPrice?: string;
  suppliers: Supplier[];
  itemType?: 'PRODUCT' | 'SERVICE'; // To distinguish between goods and services
  positionNumber?: string; // Original position number, e.g., '#1'
  parentProductName?: string; // Name of the parent position if this is a sub-item
}


// NEW: Interface for calculated potential scores
export interface PotentialScore {
  opportunity: number;
  risk: number;
  winProbability: number;
  potentialScore: number;
  daysRemaining: number; // -1 if not applicable/found
}

export interface AnalysisResult {
  lotId: string;
  analysisSummary: string; // New field for AI-generated summary
  products: Product[];
  sourceIdentifier: string; // The original URL or filename
  deadline?: string; // e.g., '2024-08-20 18:00:00'
  potentialScoreData?: PotentialScore; // New field for the calculated scores
  tenderContent?: string; // The original content used for analysis
}

// NEW: Details extracted from a contract
export interface ContractProduct {
    name: string;
    quantity: number;
    unitPrice: string; // e.g., "1,500,000 UZS"
}

export interface ContractDetails {
    customer: string;
    supplier: string;
    totalValue: string; // e.g., "75,000,000 UZS"
    products: ContractProduct[];
}


// UPDATED: Contract interface
export interface Contract {
  id: string;
  fileName: string;
  content: string; // Extracted text content of the contract
  details?: ContractDetails; // AI-analyzed structured details of the contract
  processing?: boolean; // Flag to indicate if analysis is in progress
}

// NEW: Analysis status for history tracking
export type AnalysisStatus = 'pending' | 'won' | 'lost' | 'no_bid';

// UPDATED: Analysis History
export interface AnalysisHistoryItem {
    analysisResult: AnalysisResult;
    timestamp: number;
    status: AnalysisStatus;
    winningBid?: number;
    actualCost?: number;
    deliveryNotes?: string;
}

// NEW: Bid Calculation types
export interface AdditionalCosts {
    logisticsCost: number;
    bankGuaranteeCost: number;
    commissionCost: number;
    fixedCosts: number;
    profitMarginPercent: number;
}

export interface BidRecommendation {
    recommendedBid: number;
    justification: string;
    competitorAnalysis: string;
    costBreakdown: {
        goodsTotal: number;
        logisticsCost: number;
        bankGuaranteeCost: number;
        commissionCost: number;
        fixedCosts: number;
        subtotal: number;
        profitMargin: number;
        total: number;
    };
}

// NEW: Quick Search result type
export interface QuickSearchResult {
  id: string;
  title: string;
  link: string;
  snippet: string;
  price: string | null;
  phone: string | null;
}