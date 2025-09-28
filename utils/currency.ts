import { Supplier } from '../types';

// Hardcoded exchange rates to UZS. In a real app, this would be from an API.
const exchangeRates: Record<string, number> = {
  'UZS': 1,
  'СУМ': 1, // Cyrillic Sum
  'USD': 12700,
  '$': 12700,
  'EUR': 13700,
  '€': 13700,
  'RUB': 140,
  '₽': 140,
};

// More robust parsing function
export const parsePrice = (price: Supplier['price']): { amount: number; currency: string } => {
    if (price === null || price === undefined || price === 'N/A' || price === '') {
        return { amount: Infinity, currency: 'UZS' };
    }

    // Handle object format
    if (typeof price === 'object' && price.amount) {
        const amount = Number(String(price.amount).replace(/[^0-9.-]+/g, ''));
        return { amount: isNaN(amount) ? Infinity : amount, currency: price.currency || 'UZS' };
    }

    const priceString = String(price);
    let currency = 'UZS';
    let amountStr = priceString;

    // Check for explicit currency codes/symbols
    const currencyMatch = priceString.match(/(USD|\$|EUR|€|RUB|₽|UZS|СУМ)/i);
    if (currencyMatch) {
        const matched = currencyMatch[0].toUpperCase();
        currency = matched === 'СУМ' ? 'UZS' : (exchangeRates[matched] ? matched : 'UZS');
        amountStr = priceString.replace(currencyMatch[0], '').trim();
    }
    
    const numericAmount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ''));
    
    if (isNaN(numericAmount)) {
        return { amount: Infinity, currency: 'UZS' };
    }

    return { amount: numericAmount, currency };
};

// Get the price converted to UZS as a number
export const getUzsPrice = (price: Supplier['price']): number => {
    const { amount, currency } = parsePrice(price);
    if (amount === Infinity) return Infinity;

    const rate = exchangeRates[currency.toUpperCase()] || 1; // Default to 1 if currency is unknown
    return amount * rate;
};


// Format price for display with conversion to UZS
export const formatDisplayPrice = (price: Supplier['price'], quantity: number = 1): string => {
    const original = parsePrice(price);
    if (original.amount === Infinity) {
        return 'N/A';
    }

    const uzsAmount = getUzsPrice(price);
    if (uzsAmount === Infinity) {
        return 'N/A';
    }

    const totalUzs = uzsAmount * quantity;
    const formattedUzs = `${totalUzs.toLocaleString('ru-RU')} UZS`;

    // If the original currency is not UZS, show it in parentheses
    const originalCurrencyKey = original.currency.toUpperCase();
    if (originalCurrencyKey !== 'UZS' && originalCurrencyKey !== 'СУМ') {
        const totalOriginal = original.amount * quantity;
        const formattedOriginal = `(${totalOriginal.toLocaleString('ru-RU')} ${original.currency})`;
        return `${formattedUzs} ${formattedOriginal}`;
    }

    return formattedUzs;
};
