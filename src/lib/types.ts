// Shared API types matching the Affiliate Hub backend responses.

export interface User {
  id: number;
  name: string;
  email: string;
  whatsapp: string | null;
  country: string;
  created_at?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  commission: number;
  category: string;
  image_url: string;
  created_at?: string;
  commissionAmount?: number;
}

export interface ProductDetail extends Product {
  commissionAmount: number;
  whyPromote: string[];
  promoAssets: string[];
  images: string[];
}

export interface WalletBalance {
  ngnBalance: number;
  usdBalance: number;
}

export type TransactionType = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'processing';

export interface Transaction {
  id: number;
  user_id: number;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  created_at?: string;
}

export interface DashboardStats {
  totalClicks: number;
  totalConversions: number;
  totalEarnings: number;
  conversionRate: number;
}

export interface AffiliateLink {
  id: number;
  product_id: number;
  link_code: string;
  created_at?: string;
  product_title?: string;
}
