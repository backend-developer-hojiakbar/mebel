import { TenderPlatform, TenderType } from './types';

export const PLATFORMS = [
  { value: TenderPlatform.UZEX, labelKey: 'platform.uzex' },
  { value: TenderPlatform.XT, labelKey: 'platform.xt' },
];

export const TENDER_TYPES = [
  { value: TenderType.AUCTION, labelKey: 'tenderType.auction' },
  { value: TenderType.SELECTION, labelKey: 'tenderType.selection' },
  { value: TenderType.ESHOP, labelKey: 'tenderType.eshop' },
];