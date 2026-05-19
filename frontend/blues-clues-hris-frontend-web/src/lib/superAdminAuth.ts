const TOKEN_KEY = 'sa_token';

export const getSaToken = (): string | null =>
  typeof window !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;

export const setSaToken = (token: string): void =>
  localStorage.setItem(TOKEN_KEY, token);

export const clearSaToken = (): void =>
  localStorage.removeItem(TOKEN_KEY);

export const isSaAuthenticated = (): boolean => !!getSaToken();
