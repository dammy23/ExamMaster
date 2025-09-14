import { BrowserRouter as Router, Routes, Route } from "react-router-dom"
import { ThemeProvider } from "./components/ui/theme-provider"
import { Toaster } from "./components/ui/toaster"
import { AuthProvider } from "./contexts/AuthContext"
import { Login } from "./pages/Login"
import { Register } from "./pages/Register"
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
import { StudentResults } from "./pages/student/StudentResults"
import { CreateExam } from "./pages/admin/CreateExam"
import { EditExam } from "./pages/admin/EditExam"
import { ExamDetails } from "./pages/admin/ExamDetails"
import { ExamQuestions } from "./pages/admin/ExamQuestions"
import { DatabaseSeeding } from "./pages/admin/DatabaseSeeding"

function App() {
  return (
  <AuthProvider>
    <ThemeProvider defaultTheme="light" storageKey="ui-theme">
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/seeding" element={<DatabaseSeeding />} />
          <Route path="/" element={<ProtectedRoute> <Layout /> </ProtectedRoute>}>
            <Route index element={<RoleDashboard />} />
            <Route path="admin" element={<AdminDashboard />} />
            <Route path="student" element={<StudentDashboard />} />
            <Route path="admin/exams" element={<ExamManagement />} />
            <Route path="admin/exams/create" element={<CreateExam />} />
            <Route path="admin/exams/edit/:id" element={<EditExam />} />
            <Route path="admin/exams/:id/details" element={<ExamDetails />} />
            <Route path="admin/exams/:examId/questions" element={<ExamQuestions />} />
            <Route path="admin/questions" element={<QuestionManagement />} />
            <Route path="admin/subjects" element={<Subjects />} />
            <Route path="admin/students" element={<StudentManagement />} />
            <Route path="admin/reports" element={<Reports />} />
            <Route path="admin/seeding" element={<DatabaseSeeding />} />
            <Route path="student/exam/:id" element={<ExamAttempt />} />
            <Route path="student/results" element={<StudentResults />} />
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