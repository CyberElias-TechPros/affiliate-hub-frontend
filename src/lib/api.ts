import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';

// Define the API base URL
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';

// Create an Axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor to add the authorization token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig<any>) => {
    const token = localStorage.getItem('affiliate_token');
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
      // Handle specific error statuses
      switch (error.response.status) {
        case 401:
          // Handle unauthorized access
          localStorage.removeItem('affiliate_token');
          window.location.href = '/auth';
          break;
        case 404:
          // Handle not found
          console.error('API endpoint not found');
          break;
        case 500:
          // Handle server error
          console.error('Server error');
          break;
        default:
          console.error('API error:', error.response.data);
      }
    } else if (error.request) {
      // Handle request errors
      console.error('No response received:', error.request);
    } else {
      // Handle other errors
      console.error('Error:', error.message);
    }
    return Promise.reject(error);
  }
);

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
  login: (email: string, password: string) => {
    return api.post(API_ENDPOINTS.AUTH.LOGIN, { email, password });
  },
  signup: (name: string, email: string, password: string) => {
    return api.post(API_ENDPOINTS.AUTH.SIGNUP, { name, email, password });
  },
  socialAuth: (provider: string, token: string) => {
    return api.post(API_ENDPOINTS.AUTH.SOCIAL_AUTH, { provider, token });
  },
  refreshToken: (refreshToken: string) => {
    return api.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, { refreshToken });
  },
};

export const ProductAPI = {
  getProducts: (params: { category?: string; sort?: string; page?: number; limit?: number }) => {
    return api.get(API_ENDPOINTS.PRODUCTS.LIST, { params });
  },
  getProductDetail: (id: string) => {
    return api.get(API_ENDPOINTS.PRODUCTS.DETAIL.replace('{id}', id));
  },
  searchProducts: (query: string) => {
    return api.get(API_ENDPOINTS.PRODUCTS.SEARCH, { params: { q: query } });
  },
  getCategories: () => {
    return api.get(API_ENDPOINTS.PRODUCTS.CATEGORIES);
  },
};

export const WalletAPI = {
  getBalance: () => {
    return api.get(API_ENDPOINTS.WALLET.BALANCE);
  },
  getTransactions: (params: { page?: number; limit?: number; status?: string }) => {
    return api.get(API_ENDPOINTS.WALLET.TRANSACTIONS, { params });
  },
  withdraw: (amount: number, method: string, details: any) => {
    return api.post(API_ENDPOINTS.WALLET.WITHDRAW, { amount, method, details });
  },
  getWithdrawMethods: () => {
    return api.get(API_ENDPOINTS.WALLET.WITHDRAW_METHODS);
  },
};

export const StatsAPI = {
  getDashboardStats: () => {
    return api.get(API_ENDPOINTS.STATS.DASHBOARD);
  },
  getPerformance: (params: { period?: string }) => {
    return api.get(API_ENDPOINTS.STATS.PERFORMANCE, { params });
  },
  getLeaderboard: (params: { limit?: number }) => {
    return api.get(API_ENDPOINTS.STATS.LEADERBOARD, { params });
  },
};

export const ProfileAPI = {
  getProfile: () => {
    return api.get(API_ENDPOINTS.PROFILE.GET);
  },
  updateProfile: (data: any) => {
    return api.put(API_ENDPOINTS.PROFILE.UPDATE, data);
  },
  updateBankDetails: (data: any) => {
    return api.put(API_ENDPOINTS.PROFILE.BANK_DETAILS, data);
  },
  updateSecurity: (data: any) => {
    return api.put(API_ENDPOINTS.PROFILE.SECURITY, data);
  },
};

export const AffiliateAPI = {
  getLinks: () => {
    return api.get(API_ENDPOINTS.AFFILIATE.LINKS);
  },
  generateLink: (productId: string) => {
    return api.post(API_ENDPOINTS.AFFILIATE.GENERATE_LINK, { productId });
  },
  getAssets: (productId: string) => {
    return api.get(API_ENDPOINTS.AFFILIATE.ASSETS, { params: { productId } });
  },
};

export default api;