// Authentication API functions
export function getStoredToken(): string {
  return localStorage.getItem('token') || '';
}

export function setStoredToken(token: string): void {
  localStorage.setItem('token', token);
}

export function hasValidToken(): boolean {
  const token = getStoredToken();
  if (!token) return false;
  
  try {
    // Simple JWT validation (check if it has three parts)
    const parts = token.split('.');
    return parts.length === 3;
  } catch {
    return false;
  }
}

export function clearAuthToken(): void {
  localStorage.removeItem('token');
}