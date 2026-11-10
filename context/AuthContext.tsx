// context/AuthContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type User = {
  id: number;          // ← add
  name: string;
  email: string;
  is_admin?: boolean;
} | null;

type AuthContextType = {
  user: User;
  isLoggedIn: boolean;
  isAdmin: boolean;
  setUser: (user: User) => void;
  checkSession: () => Promise<void>;
  clearSession: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  isAdmin: false,
  setUser: () => {},
  checkSession: async () => {},
  clearSession: () => {},
});

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(null);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const clearSession = useCallback(() => {
    if (isMounted.current) setUser(null);
  }, []);

  const checkSession = useCallback(async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${API_BASE}/profile`, {
        credentials: "include",
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.status === 401) {
        if (isMounted.current) setUser(null);
        return;
      }
      if (!response.ok) {
        if (isMounted.current) setUser(null);
        return;
      }

      const data = await response.json();

      if (data?.status === "success" && data?.user) {
        if (isMounted.current) {
          setUser({
            id: data.user.id,          // ← add
            name: data.user.name,
            email: data.user.email,
            is_admin: !!data.user.is_admin,
          });
        }
      } else {
        if (isMounted.current) setUser(null);
      }
    } catch (e) {
      clearTimeout(timeoutId);
      if (isMounted.current) setUser(null);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoggedIn: !!user,
        isAdmin: !!user?.is_admin, // ← single source of truth
        setUser,
        checkSession,
        clearSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
