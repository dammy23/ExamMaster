import React, { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '@/api/auth'
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
  register: (name: string, email: string, password: string, role: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  // Check if user is logged in on app start
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken')
      console.log('AuthContext: Checking auth, token exists:', !!token)
      
      if (token) {
        try {
          console.log('AuthContext: Fetching current user...')
          const response = await getCurrentUser()
          const userData = (response as any).data
          console.log('AuthContext: User data received:', userData)
          setUser(userData)
        } catch (error) {
          console.error('AuthContext: Error fetching user:', error)
          // Clear invalid tokens
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
        }
      } else {
        console.log('AuthContext: No token found')
      }
      setLoading(false)
    }

    checkAuth()
  }, [])

  const login = async (email: string, password: string) => {
    try {
      console.log('AuthContext: Attempting login for:', email)
      const response = await apiLogin(email, password)
      const { accessToken, refreshToken, user: userData } = (response as any).data
      
      console.log('AuthContext: Login successful, user data:', userData)
      
      localStorage.setItem('accessToken', accessToken)
      localStorage.setItem('refreshToken', refreshToken)
      setUser(userData)
      
      toast({
        title: "Success",
        description: "Logged in successfully",
      })
    } catch (error: any) {
      console.error('AuthContext: Login error:', error)
      toast({
        title: "Error",
        description: error.message || "Login failed",
        variant: "destructive"
      })
      throw error
    }
  }

  const register = async (name: string, email: string, password: string, role: string) => {
    try {
      console.log('AuthContext: Attempting registration for:', email, 'role:', role)
      const response = await apiRegister(name, email, password, role)
      const { accessToken, user: userData } = (response as any).data
      
      console.log('AuthContext: Registration successful, user data:', userData)
      
      localStorage.setItem('accessToken', accessToken)
      setUser(userData)
      
      toast({
        title: "Success",
        description: "Account created successfully",
      })
    } catch (error: any) {
      console.error('AuthContext: Registration error:', error)
      toast({
        title: "Error",
        description: error.message || "Registration failed",
        variant: "destructive"
      })
      throw error
    }
  }

  const logout = () => {
    console.log('AuthContext: Logging out user:', user?.email)
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
    register,
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