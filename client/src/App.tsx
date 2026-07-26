import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/ui/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { AuthProvider } from "./contexts/AuthContext"
import { Login } from "./pages/Login"
import { ForgotPassword } from "./pages/ForgotPassword"
import { ResetPassword } from "./pages/ResetPassword"
import { ProtectedRoute } from "./components/ProtectedRoute"
import { RoleDashboard } from "./components/RoleDashboard"
import { Layout } from "./components/Layout"
import { BlankPage } from "./pages/BlankPage"
import { AdminDashboard } from "./pages/admin/AdminDashboard"
import { StudentDashboard } from "./pages/student/StudentDashboard"
import { ExamManagement } from "./pages/admin/ExamManagement"
import { QuestionManagement } from "./pages/admin/QuestionManagement"
import { Subjects } from "./pages/admin/Subjects"
import { StudentManagement } from "./pages/admin/StudentManagement"
import { Reports } from "./pages/admin/Reports"
import { ExamAttempt } from "./pages/student/ExamAttempt"
import { MobileExamAttempt } from "./pages/student/MobileExamAttempt"
import { ExamInstructions } from "./pages/student/ExamInstructions"
import { StudentResults } from "./pages/student/StudentResults"
import { AttemptResult } from "./pages/student/AttemptResult"
import { CreateExam } from "./pages/admin/CreateExam"
import { EditExam } from "./pages/admin/EditExam"
import { ExamDetails } from "./pages/admin/ExamDetails"
import { ExamQuestions } from "./pages/admin/ExamQuestions"
import { StudentVideoReview } from "./pages/admin/StudentVideoReview"
import { GradingQueue } from "./pages/admin/GradingQueue"
import { GradeAttempt } from "./pages/admin/GradeAttempt"
import { DatabaseSeeding } from "./pages/admin/DatabaseSeeding"
import { SettingsPage } from "./pages/admin/SettingsPage"
import { AIChat } from "./pages/admin/AIChat"

function App() {
  return (
  <AuthProvider>
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
          <Route path="/seeding" element={<DatabaseSeeding />} />
          {/* Fullscreen routes without layout/sidebar */}
          <Route path="/exam-fullscreen/:id" element={
            <ProtectedRoute>
              <ExamAttempt />
            </ProtectedRoute>
          } />
          {/* Student fullscreen dashboard */}
          <Route path="/student" element={
            <ProtectedRoute>
              <StudentDashboard />
            </ProtectedRoute>
          } />
          {/* Student exam routes (fullscreen) */}
          <Route path="/student/exam/:id/instructions" element={
            <ProtectedRoute>
              <ExamInstructions />
            </ProtectedRoute>
          } />
          <Route path="/student/exam/:id" element={
            <ProtectedRoute>
              <ExamAttempt />
            </ProtectedRoute>
          } />
          <Route path="/student/exam/:id/mobile" element={
            <ProtectedRoute>
              <MobileExamAttempt />
            </ProtectedRoute>
          } />
          <Route path="/student/results" element={
            <ProtectedRoute>
              <StudentResults />
            </ProtectedRoute>
          } />
          <Route path="/student/results/:attemptId" element={
            <ProtectedRoute>
              <AttemptResult />
            </ProtectedRoute>
          } />
          <Route path="/" element={<ProtectedRoute> <Layout /> </ProtectedRoute>}>
            <Route index element={<RoleDashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="admin/exams" element={<ExamManagement />} />
            <Route path="admin/exams/create" element={<CreateExam />} />
            <Route path="admin/exams/edit/:id" element={<EditExam />} />
            <Route path="admin/exams/:id/details" element={<ExamDetails />} />
            <Route path="admin/exams/:examId/questions" element={<ExamQuestions />} />
            <Route path="admin/exams/:examId/video-review" element={<StudentVideoReview />} />
            <Route path="admin/exams/:examId/video-review/:attemptId" element={<StudentVideoReview />} />
            <Route path="admin/questions" element={<QuestionManagement />} />
            <Route path="admin/subjects" element={<Subjects />} />
            <Route path="admin/students" element={<StudentManagement />} />
            <Route path="admin/grading" element={<GradingQueue />} />
            <Route path="admin/grading/:attemptId" element={<GradeAttempt />} />
            <Route path="admin/reports" element={<Reports />} />
            <Route path="admin/ai-chat" element={<AIChat />} />
            <Route path="admin/settings" element={<SettingsPage />} />
            <Route path="admin/seeding" element={<DatabaseSeeding />} />
          </Route>
          <Route path="*" element={<BlankPage />} />
        </Routes>
      </Router>
      <Toaster />
    </ThemeProvider>
  </AuthProvider>
  )
}

export default App