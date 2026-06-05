import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface User {
  token: string;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  roleId: number;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Khôi phục session từ localStorage khi reload trang
    const storedUser = localStorage.getItem('tvien_user');
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (parsedUser && parsedUser.userId) {
          setUser(parsedUser);
        } else {
          // Xóa session cũ (do phiên bản code cũ không lưu userId)
          localStorage.removeItem('tvien_user');
        }
      } catch (e) {
        console.error("Failed to parse stored user", e);
        localStorage.removeItem('tvien_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('tvien_user', JSON.stringify(userData));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tvien_user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
