/**
 * Authentication Service
 * Manages JWT tokens, user state, role guards, and login/logout lifecycles.
 */

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: "student" | "examiner" | "admin";
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

const TOKEN_KEY = "intelliexam_token";
const USER_KEY = "intelliexam_user";

const API_BASE = (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL : "").replace(/\/$/, "");

export const authService = {
  getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },

  getUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },

  setUser(user: AuthUser): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  },

  clearAuth(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  },

  isAuthenticated(): boolean {
    return !!this.getToken();
  },

  isExaminer(): boolean {
    const user = this.getUser();
    return !!user && (user.role === "examiner" || user.role === "admin");
  },

  isAdmin(): boolean {
    const user = this.getUser();
    return !!user && user.role === "admin";
  },

  isStudent(): boolean {
    const user = this.getUser();
    return !!user && user.role === "student";
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    let res: Response;
    const url = `${API_BASE}/api/auth/login`;

    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
    } catch (err: any) {
      throw new Error("Unable to connect to the authentication service. Please ensure the backend is running.");
    }

    if (!res.ok) {
      let errorMsg = "Invalid email or password";
      try {
        const err = await res.json();
        if (err.detail) {
          errorMsg = err.detail;
        }
      } catch {
        if (res.status === 401) {
          errorMsg = "Invalid email or password. Please verify your credentials.";
        } else if (res.status === 403) {
          errorMsg = "User account is inactive. Please contact an administrator.";
        } else if (res.status >= 500) {
          errorMsg = "Authentication server error. Please try again later.";
        } else {
          errorMsg = `Login failed with status code ${res.status}`;
        }
      }
      throw new Error(errorMsg);
    }

    const data: LoginResponse = await res.json();
    this.setToken(data.access_token);
    this.setUser(data.user);
    return data;
  },

  async register(name: string, email: string, password: string, role: string): Promise<AuthUser> {
    let res: Response;
    const url = `${API_BASE}/api/auth/register`;

    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
      });
    } catch (err: any) {
      throw new Error("Unable to connect to the authentication service. Please ensure the backend is running.");
    }

    if (!res.ok) {
      let errorMsg = "Registration failed";
      try {
        const err = await res.json();
        if (err.detail) {
          errorMsg = err.detail;
        }
      } catch {
        errorMsg = `Registration failed with status ${res.status}`;
      }
      throw new Error(errorMsg);
    }

    return await res.json();
  },

  async getMe(): Promise<AuthUser> {
    const token = this.getToken();
    if (!token) throw new Error("Unauthenticated");

    let res: Response;
    const url = `${API_BASE}/api/auth/me`;

    try {
      res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err: any) {
      throw new Error("Unable to connect to the authentication service.");
    }

    if (!res.ok) {
      this.clearAuth();
      throw new Error("Session expired. Please log in again.");
    }

    const user: AuthUser = await res.json();
    this.setUser(user);
    return user;
  },

  logout(): void {
    this.clearAuth();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
  },
};
