// context/AuthContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";

type User = { name: string; email: string } | null;

type AuthContextType = {
  user: User;
  isLoggedIn: boolean;
  setUser: (user: User) => void;
  checkSession: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoggedIn: false,
  setUser: () => {},
  checkSession: async () => {},
});

const API_BASE = process.env.EXPO_PUBLIC_BASE_API;

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User>(null);

  const checkSession = async () => {
    try {
      const response = await fetch(`${API_BASE}/profile`, {
        credentials: "include",
      });
      if (response.status === 401) {
        setUser(null);
        return;
      }
      const data = await response.json();
      if (data.status === "success" && data.user) {
        setUser({ name: data.user.name, email: data.user.email });
      }
    } catch (e) {
      console.log("Session check error:", e);
    }
  };

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, isLoggedIn: !!user, setUser, checkSession }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
