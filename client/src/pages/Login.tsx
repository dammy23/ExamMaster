import { useState } from "react"
import { useNavigate, Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/hooks/useToast"
import { Database, Info, AlertTriangle } from "lucide-react"

export function Login() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showSeedingHint, setShowSeedingHint] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setShowSeedingHint(false)

    try {
      await login(email, password)
      navigate("/")
    } catch (error: any) {
      console.error("Login error:", error.message)

      // Show seeding hint if login fails with user not found error
      if (error.message.includes("Email or password is incorrect") || 
          error.message.includes("visit /seeding")) {
        setShowSeedingHint(true)
      }

      toast({
        title: "Login Failed",
        description: error.message,
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight">CBE System</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Computer-Based Examination Platform
          </p>
        </div>

        {/* Always show seeding info for first-time users */}
        {/* <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <strong>First time user?</strong> You need to{" "}
            <Link to="/seeding" className="underline font-medium hover:text-blue-900">
              create initial accounts
            </Link>{" "}
            before logging in.
          </AlertDescription>
        </Alert> */}

        {showSeedingHint && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Account not found!</strong> Please{" "}
              <Link to="/seeding" className="underline font-medium">
                visit the seeding page
              </Link>{" "}
              to create the admin and student accounts first.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Sign in to your account</CardTitle>
            <CardDescription>
              Enter your email and password to access the system
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col space-y-4">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in..." : "Sign in"}
              </Button>

              <div className="text-sm text-center space-y-2">
                {/* <p className="text-muted-foreground">
                  Don't have an account?{" "}
                  <Link to="/register" className="font-medium text-primary hover:underline">
                    Sign up
                  </Link>
                </p> */}
                <div className="flex items-center justify-center gap-2">
                  {/* <Link 
                    to="/seeding" 
                    className="flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-md transition-colors"
                  >
                    <Database className="h-3 w-3" />
                    Set up database
                  </Link> */}
                </div>
              </div>
            </CardFooter>
          </form>
        </Card>

        {/* Sample credentials info */}
        <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Sample Credentials</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div>
              <strong>Admin:</strong> admin@yahoo.com / admin123
            </div>
            <div>
              <strong>Student:</strong> student1@example.com / student123
            </div>
            <p className="text-muted-foreground">
              (Create these accounts first using the seeding page)
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}