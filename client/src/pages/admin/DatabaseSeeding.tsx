import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Loader2, Users, UserCheck, Database, CheckCircle, AlertCircle } from "lucide-react"
import { seedAdmin, seedStudents } from "@/api/seed"
import { useToast } from "@/hooks/useToast"

export function DatabaseSeeding() {
  const [adminLoading, setAdminLoading] = useState(false)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [adminSeeded, setAdminSeeded] = useState(false)
  const [studentsSeeded, setStudentsSeeded] = useState(false)
  const [adminUser, setAdminUser] = useState<any>(null)
  const [studentUsers, setStudentUsers] = useState<any[]>([])
  const { toast } = useToast()

  const handleSeedAdmin = async () => {
    setAdminLoading(true)
    try {
      console.log('Seeding admin user...')
      const response = await seedAdmin()
      const result = response as any
      
      console.log('Admin seeding response:', result)
      setAdminSeeded(true)
      setAdminUser(result.user)
      
      toast({
        title: "Success",
        description: result.message || "Admin user created successfully",
      })
    } catch (error: any) {
      console.error('Error seeding admin:', error)
      
      if (error.message.includes('already exists')) {
        setAdminSeeded(true)
        toast({
          title: "Info",
          description: "Admin user already exists",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create admin user",
          variant: "destructive"
        })
      }
    } finally {
      setAdminLoading(false)
    }
  }

  const handleSeedStudents = async () => {
    setStudentsLoading(true)
    try {
      console.log('Seeding student users...')
      const response = await seedStudents()
      const result = response as any
      
      console.log('Students seeding response:', result)
      setStudentsSeeded(true)
      setStudentUsers(result.users || [])
      
      toast({
        title: "Success",
        description: result.message || "Student users created successfully",
      })
    } catch (error: any) {
      console.error('Error seeding students:', error)
      
      if (error.message.includes('already exist')) {
        setStudentsSeeded(true)
        toast({
          title: "Info",
          description: "Student users already exist",
        })
      } else {
        toast({
          title: "Error",
          description: error.message || "Failed to create student users",
          variant: "destructive"
        })
      }
    } finally {
      setStudentsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Database Seeding</h1>
          <p className="text-muted-foreground">
            Initialize the database with sample users for testing
          </p>
        </div>
      </div>

      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          This page allows you to create initial users in the database. Run this once to set up admin and student accounts for testing.
        </AlertDescription>
      </Alert>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Admin User Seeding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Admin User
              {adminSeeded && <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Created
              </Badge>}
            </CardTitle>
            <CardDescription>
              Create an admin user account for managing the system
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm"><strong>Email:</strong> admin@yahoo.com</p>
              <p className="text-sm"><strong>Password:</strong> admin123</p>
              <p className="text-sm"><strong>Role:</strong> Admin</p>
            </div>
            
            {adminUser && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Admin user created successfully! You can now login with the credentials above.
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={handleSeedAdmin} 
              disabled={adminLoading || adminSeeded}
              className="w-full"
            >
              {adminLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Admin...
                </>
              ) : adminSeeded ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Admin Created
                </>
              ) : (
                <>
                  <UserCheck className="mr-2 h-4 w-4" />
                  Create Admin User
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Student Users Seeding */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Student Users
              {studentsSeeded && <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                Created
              </Badge>}
            </CardTitle>
            <CardDescription>
              Create sample student accounts for testing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Sample Students:</p>
              <div className="text-xs space-y-1">
                <p>• student1@example.com (password: student123)</p>
                <p>• student2@example.com (password: student123)</p>
                <p>• student3@example.com (password: student123)</p>
              </div>
            </div>
            
            {studentUsers.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {studentUsers.length} student users created successfully!
                </AlertDescription>
              </Alert>
            )}
            
            <Button 
              onClick={handleSeedStudents} 
              disabled={studentsLoading || studentsSeeded}
              className="w-full"
            >
              {studentsLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating Students...
                </>
              ) : studentsSeeded ? (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Students Created
                </>
              ) : (
                <>
                  <Users className="mr-2 h-4 w-4" />
                  Create Student Users
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {(adminSeeded || studentsSeeded) && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Next Steps:</strong> You can now go to the <a href="/login" className="underline">login page</a> and use the credentials above to access the system.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}