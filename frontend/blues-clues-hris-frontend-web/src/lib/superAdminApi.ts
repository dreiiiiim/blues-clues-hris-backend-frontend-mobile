import axios from 'axios';

const SA_BASE_URL =
  (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:5000/api/tribeX/auth/v1') + '/super-admin';

export const saApi = axios.create({ baseURL: SA_BASE_URL });

saApi.interceptors.request.use((config) => {
  if (globalThis.window !== undefined) {
    const token = localStorage.getItem('sa_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

saApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && globalThis.window !== undefined) {
      localStorage.removeItem('sa_token');
      globalThis.location.href = '/super-admin/login';
    }
    return Promise.reject(err);
  },
);
