import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { EmptyState } from "@/components/ui/empty-state"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ClipboardCheck } from "lucide-react"
import { getPendingGradingAttempts } from "@/api/examAttempts"
import { useToast } from "@/hooks/useToast"

interface PendingGradingAttempt {
  _id: string
  studentId: {
    _id: string
    name: string
    email: string
  }
  examId: {
    _id: string
    title: string
    gradingMethod: 'ai' | 'manual'
  }
  endTime?: string
  createdAt: string
}

export function GradingQueue() {
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState<PendingGradingAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const response = await getPendingGradingAttempts()
        setAttempts((response as any).attempts)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load attempts pending grading",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAttempts()
  }, [toast])

  if (loading) {
    return <LoadingState label="Loading grading queue..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Grading Queue</h1>
        <p className="text-muted-foreground">
          Exam attempts awaiting a grade
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Pending Grading ({attempts.length})
          </CardTitle>
          <CardDescription>
            Attempts with theory questions that need a score
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attempts.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Exam</TableHead>
                    <TableHead>Grading Method</TableHead>
                    <TableHead>Submitted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow
                      key={attempt._id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/admin/grading/${attempt._id}`)}
                    >
                      <TableCell>
                        <div className="font-medium">{attempt.studentId.name}</div>
                        <div className="text-sm text-muted-foreground">{attempt.studentId.email}</div>
                      </TableCell>
                      <TableCell>{attempt.examId.title}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {attempt.examId.gradingMethod === 'ai' ? 'AI' : 'Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {new Date(attempt.endTime || attempt.createdAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No attempts pending grading" description="Attempts that need a grade will appear here." />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
