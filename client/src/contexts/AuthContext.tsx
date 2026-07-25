import React, { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, logout as apiLogout } from '@/api/auth'
import { getCurrentUser } from '@/api/users'
import { useToast } from '@/hooks/useToast'

interface User {
  _id: string
  name: string
  email: string
  role: 'admin' | 'student'
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken')

      if (token) {
        try {
          const response = await getCurrentUser()
          const userData = (response as any).data
          setUser(userData)
        } catch (error) {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      const response = await apiLogin(email, password)
      const { accessToken, refreshToken, user: userData } = (response as any).data

      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      setUser(userData)

      toast({
        title: "Success",
        description: "Logged in successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive"
      })
      throw error
    }
  }

  const logout = () => {
    apiLogout()
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    setUser(null)

    toast({
      title: "Success",
      description: "Logged out successfully",
    })
  }

  const value = {
    user,
    login,
    logout,
    loading
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
