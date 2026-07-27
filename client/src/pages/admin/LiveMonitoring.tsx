import { useEffect, useRef, useState } from "react"
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
import { Activity, AlertTriangle, Monitor } from "lucide-react"
import { getLiveAttempts, type LiveAttempt } from "@/api/examAttempts"
import { getSocket } from "@/lib/socket"
import { useToast } from "@/hooks/useToast"
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"

interface AlertEntry {
  attemptId: string
  activity: string
  timestamp: string
}

function formatElapsed(startTime: string, now: number) {
  const seconds = Math.max(0, Math.floor((now - new Date(startTime).getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}m ${remainingSeconds}s`
}

export function LiveMonitoring() {
  const [attempts, setAttempts] = useState<LiveAttempt[]>([])
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())
  const [alerts, setAlerts] = useState<AlertEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const { toast } = useToast()
  const highlightTimers = useRef<{ [attemptId: string]: ReturnType<typeof setTimeout> }>({})

  useEffect(() => {
    const fetchAttempts = async () => {
      try {
        const response = await getLiveAttempts()
        setAttempts((response as any).attempts)
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to load live attempts",
          variant: "destructive"
        })
      } finally {
        setLoading(false)
      }
    }

    fetchAttempts()
  }, [toast])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    const handleStarted = (payload: any) => {
      setAttempts(prev => [{
        _id: payload.attemptId,
        examId: payload.examId,
        examTitle: payload.examTitle,
        studentId: payload.studentId,
        studentName: payload.studentName,
        studentEmail: payload.studentEmail,
        startTime: payload.startTime,
        tabSwitches: 0,
        latestActivity: null,
        updatedAt: payload.startTime
      }, ...prev])
    }

    const handleActivity = (payload: any) => {
      setAttempts(prev => prev.map(a =>
        a._id === payload.attemptId
          ? { ...a, tabSwitches: payload.tabSwitches, latestActivity: { activity: payload.activity, timestamp: payload.timestamp } }
          : a
      ))

      setRecentlyUpdated(prev => new Set(prev).add(payload.attemptId))
      if (highlightTimers.current[payload.attemptId]) {
        clearTimeout(highlightTimers.current[payload.attemptId])
      }
      highlightTimers.current[payload.attemptId] = setTimeout(() => {
        setRecentlyUpdated(prev => {
          const next = new Set(prev)
          next.delete(payload.attemptId)
          return next
        })
      }, 2000)

      if (payload.isViolation) {
        setAlerts(prev => [
          { attemptId: payload.attemptId, activity: payload.activity, timestamp: payload.timestamp },
          ...prev
        ].slice(0, 20))
      }
    }

    const handleEnded = (payload: any) => {
      setAttempts(prev => prev.filter(a => a._id !== payload.attemptId))
      toast({
        title: "Attempt Submitted",
        description: `${payload.examTitle} — status: ${payload.status}`
      })
    }

    const handleScreenshot = (payload: any) => {
      setAttempts(prev => prev.map(a =>
        a._id === payload.attemptId
          ? { ...a, latestScreenshot: payload.imageDataUrl }
          : a
      ))
    }

    socket.on('attempt:started', handleStarted)
    socket.on('attempt:activity', handleActivity)
    socket.on('attempt:ended', handleEnded)
    socket.on('screenshot:pushed', handleScreenshot)

    return () => {
      socket.off('attempt:started', handleStarted)
      socket.off('attempt:activity', handleActivity)
      socket.off('attempt:ended', handleEnded)
      socket.off('screenshot:pushed', handleScreenshot)
    }
  }, [toast])

  if (loading) {
    return <LoadingState label="Loading live attempts..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Live Monitoring</h1>
        <p className="text-muted-foreground">
          Exam attempts currently in progress
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Active Now ({attempts.length})
          </CardTitle>
          <CardDescription>
            Updates live as students start, interact with, and submit exams
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
                    <TableHead>Elapsed</TableHead>
                    <TableHead>Tab Switches</TableHead>
                    <TableHead>Latest Activity</TableHead>
                    <TableHead>Screen</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attempts.map((attempt) => (
                    <TableRow
                      key={attempt._id}
                      className={recentlyUpdated.has(attempt._id) ? "bg-muted/50 transition-colors" : "transition-colors"}
                    >
                      <TableCell>
                        <div className="font-medium">{attempt.studentName}</div>
                        <div className="text-sm text-muted-foreground">{attempt.studentEmail}</div>
                      </TableCell>
                      <TableCell>{attempt.examTitle}</TableCell>
                      <TableCell>{formatElapsed(attempt.startTime, now)}</TableCell>
                      <TableCell>{attempt.tabSwitches}</TableCell>
                      <TableCell>
                        {attempt.latestActivity ? (
                          <Badge variant="outline">{attempt.latestActivity.activity.replace(/_/g, ' ')}</Badge>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {attempt.latestScreenshot ? (
                          <Dialog>
                            <DialogTrigger asChild>
                              <button className="block h-10 w-16 overflow-hidden rounded border">
                                <img
                                  src={attempt.latestScreenshot}
                                  alt={`${attempt.studentName}'s screen`}
                                  className="h-full w-full object-cover"
                                />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-3xl">
                              <img
                                src={attempt.latestScreenshot}
                                alt={`${attempt.studentName}'s screen`}
                                className="w-full rounded"
                              />
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Monitor className="h-4 w-4 text-muted-foreground" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="gap-1 animate-pulse">
                          <Activity className="h-3 w-3" />
                          Live
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState title="No exams in progress" description="Students currently taking an exam will appear here in real time." />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Alerts
          </CardTitle>
          <CardDescription>Security-monitoring violations, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length > 0 ? (
            <div className="space-y-2">
              {alerts.map((alert, index) => (
                <div key={index} className="flex items-center justify-between text-sm border-b last:border-b-0 pb-2 last:pb-0">
                  <span>{alert.activity.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground">{new Date(alert.timestamp).toLocaleTimeString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No violations reported yet.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
