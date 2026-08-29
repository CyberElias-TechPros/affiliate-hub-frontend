import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosError,
  InternalAxiosRequestConfig,
  AxiosHeaders,
} from 'axios';
import type {
  AuthResponse,
  Product,
  ProductDetail,
  WalletBalance,
  Transaction,
  DashboardStats,
  AffiliateLink,
} from './types';

export const TOKEN_KEY = 'affiliate_token';
export const USER_KEY = 'affiliate_user';

// Base URL is configurable at build time (Vercel env VITE_API_BASE_URL).
// Falls back to a relative path so the Vite dev server / hosting platform can
// proxy /api/* to the backend — never call localhost from the browser.
const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1';

// Create an Axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor to add the authorization token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers = config.headers || new AxiosHeaders();
      config.headers.set('Authorization', `Bearer ${token}`);
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Token expired/invalid — clear session and send to auth
          if (!window.location.pathname.startsWith('/auth')) {
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            window.location.href = '/auth';
          }
          break;
        case 403:
          console.error('Forbidden:', error.response.data);
          break;
        case 404:
          console.error('API endpoint not found');
          break;
        case 500:
          console.error('Server error');
          break;
        default:
          console.error('API error:', error.response.data);
      }
    } else if (error.request) {
      console.error('No response received:', error.request);
    } else {
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Centralized error message extraction for display in the UI.
export function getApiError(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { error?: string; message?: string } | undefined;
    if (error.response?.status === 401) {
      return 'Invalid email or password';
    }
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (error.code === 'ERR_NETWORK') {
      return 'Unable to reach the server. Check your connection and try again.';
    }
    if (error.response?.status) {
      return `Request failed (${error.response.status}). Please try again.`;
    }
    return error.message || 'Something went wrong';
  }
  return 'Something went wrong';
}

// Define API endpoints
export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: '/auth/login',
    SIGNUP: '/auth/signup',
    SOCIAL_AUTH: '/auth/social-auth',
    REFRESH_TOKEN: '/auth/refresh-token',
  },
  PRODUCTS: {
    LIST: '/products',
    DETAIL: '/products/{id}',
    SEARCH: '/products/search',
    CATEGORIES: '/products/categories',
  },
  WALLET: {
    BALANCE: '/wallet/balance',
    TRANSACTIONS: '/wallet/transactions',
    WITHDRAW: '/wallet/withdraw',
    WITHDRAW_METHODS: '/wallet/withdraw-methods',
  },
  STATS: {
    DASHBOARD: '/stats/dashboard',
    PERFORMANCE: '/stats/performance',
    LEADERBOARD: '/stats/leaderboard',
  },
  PROFILE: {
    GET: '/profile',
    UPDATE: '/profile/update',
    BANK_DETAILS: '/profile/bank-details',
    SECURITY: '/profile/security',
  },
  AFFILIATE: {
    LINKS: '/affiliate/links',
    GENERATE_LINK: '/affiliate/generate-link',
    ASSETS: '/affiliate/assets',
  },
};

// Define API functions
export const AuthAPI = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>(API_ENDPOINTS.AUTH.LOGIN, { email, password }),
  signup: (name: string, email: string, password: string) =>
    api.post<AuthResponse>(API_ENDPOINTS.AUTH.SIGNUP, { name, email, password }),
  socialAuth: (provider: string, token: string) =>
    api.post<AuthResponse>(API_ENDPOINTS.AUTH.SOCIAL_AUTH, { provider, token }),
  refreshToken: (refreshToken: string) =>
    api.post<{ token: string }>(API_ENDPOINTS.AUTH.REFRESH_TOKEN, { refreshToken }),
};

export interface ProductQuery {
  category?: string;
  sort?: string;
  page?: number;
  limit?: number;
}

export const ProductAPI = {
  getProducts: (params?: ProductQuery) =>
    api.get<Product[]>(API_ENDPOINTS.PRODUCTS.LIST, { params }),
  getProductDetail: (id: string | number) =>
    api.get<ProductDetail>(API_ENDPOINTS.PRODUCTS.DETAIL.replace('{id}', String(id))),
  searchProducts: (query: string) =>
    api.get<Product[]>(API_ENDPOINTS.PRODUCTS.SEARCH, { params: { q: query } }),
  getCategories: () =>
    api.get<string[]>(API_ENDPOINTS.PRODUCTS.CATEGORIES),
};

export const WalletAPI = {
  getBalance: () =>
    api.get<WalletBalance>(API_ENDPOINTS.WALLET.BALANCE),
  getTransactions: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<Transaction[]>(API_ENDPOINTS.WALLET.TRANSACTIONS, { params }),
  withdraw: (amount: number, method: string, details?: Record<string, unknown>) =>
    api.post<{ message: string; transactionId?: number }>(API_ENDPOINTS.WALLET.WITHDRAW, {
      amount,
      method,
      details,
    }),
  getWithdrawMethods: () =>
    api.get<{ id: string; name: string; description: string }[]>(
      API_ENDPOINTS.WALLET.WITHDRAW_METHODS
    ),
};

export const StatsAPI = {
  getDashboardStats: () =>
    api.get<DashboardStats>(API_ENDPOINTS.STATS.DASHBOARD),
  getPerformance: (params?: { period?: string }) =>
    api.get(API_ENDPOINTS.STATS.PERFORMANCE, { params }),
  getLeaderboard: (params?: { limit?: number }) =>
    api.get(API_ENDPOINTS.STATS.LEADERBOARD, { params }),
};

export const ProfileAPI = {
  getProfile: () =>
    api.get(API_ENDPOINTS.PROFILE.GET),
  updateProfile: (data: { name?: string; whatsapp?: string; country?: string }) =>
    api.put(API_ENDPOINTS.PROFILE.UPDATE, data),
  updateBankDetails: (data: { bank_name?: string; account_name?: string; account_number?: string }) =>
    api.put(API_ENDPOINTS.PROFILE.BANK_DETAILS, data),
  updateSecurity: (data: { currentPassword?: string; newPassword?: string }) =>
    api.put(API_ENDPOINTS.PROFILE.SECURITY, data),
};

export const AffiliateAPI = {
  getLinks: () =>
    api.get<AffiliateLink[]>(API_ENDPOINTS.AFFILIATE.LINKS),
  generateLink: (productId: string | number) =>
    api.post<{ linkCode: string; affiliateLink: string }>(
      API_ENDPOINTS.AFFILIATE.GENERATE_LINK,
      { productId }
    ),
  getAssets: (productId: string | number) =>
    api.get(API_ENDPOINTS.AFFILIATE.ASSETS, { params: { productId } }),
};

export default api;
