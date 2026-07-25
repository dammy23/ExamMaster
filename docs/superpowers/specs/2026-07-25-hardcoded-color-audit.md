# Hardcoded Color Audit

Generated during the Design System & App Shell phase (2026-07-25). These are
literal Tailwind color utility classes (`bg-blue-600`, `text-red-500`, etc.)
that bypass the design-token system introduced in that phase, found via:

    grep -rnE "(bg|text|border)-(red|blue|green|yellow|amber|orange|purple|pink|indigo|teal|emerald|cyan|gray|slate|zinc|neutral|stone)-[0-9]{2,3}" client/src/pages client/src/components --include="*.tsx"

They will NOT pick up the new navy/slate/teal palette automatically and will
look visually inconsistent next to token-driven components. Fixing them means
editing individual page content, which is out of scope for the shell phase —
**each of these should be fixed as its own page is touched by the Admin or
Student phase**, not as a standalone sweep.

## Raw findings

```
client/src/pages/admin/AdminDashboard.tsx:113:        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
client/src/pages/admin/AdminDashboard.tsx:116:            <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
client/src/pages/admin/AdminDashboard.tsx:119:            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{stats.totalExams}</div>
client/src/pages/admin/AdminDashboard.tsx:120:            <p className="text-xs text-blue-600 dark:text-blue-400">
client/src/pages/admin/AdminDashboard.tsx:126:        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
client/src/pages/admin/AdminDashboard.tsx:129:            <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
client/src/pages/admin/AdminDashboard.tsx:132:            <div className="text-2xl font-bold text-green-700 dark:text-green-300">{stats.activeExams}</div>
client/src/pages/admin/AdminDashboard.tsx:133:            <p className="text-xs text-green-600 dark:text-green-400">
client/src/pages/admin/AdminDashboard.tsx:139:        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
client/src/pages/admin/AdminDashboard.tsx:142:            <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
client/src/pages/admin/AdminDashboard.tsx:145:            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{stats.totalStudents}</div>
client/src/pages/admin/AdminDashboard.tsx:146:            <p className="text-xs text-purple-600 dark:text-purple-400">
client/src/pages/admin/AdminDashboard.tsx:152:        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
client/src/pages/admin/AdminDashboard.tsx:155:            <TrendingUp className="h-4 w-4 text-orange-600 dark:text-orange-400" />
client/src/pages/admin/AdminDashboard.tsx:158:            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{stats.recentSubmissions}</div>
client/src/pages/admin/AdminDashboard.tsx:159:            <p className="text-xs text-orange-600 dark:text-orange-400">
client/src/pages/admin/AIChat.tsx:987:                              <CheckCircle className="h-3 w-3 text-green-500" />
client/src/pages/admin/AIChat.tsx:989:                              <AlertCircle className="h-3 w-3 text-amber-500" />
client/src/pages/admin/AIChat.tsx:1029:                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
client/src/pages/admin/AIChat.tsx:1031:                          <AlertCircle className="h-3 w-3 text-amber-600" />
client/src/pages/admin/AIChat.tsx:1032:                          <span className="text-xs font-medium text-amber-800">
client/src/pages/admin/AIChat.tsx:1036:                        <p className="text-xs text-amber-700">
client/src/pages/admin/AIChat.tsx:1204:                                    <CheckCircle className="h-4 w-4 text-green-500" />
client/src/pages/admin/AIChat.tsx:1337:                <p className="text-xs text-blue-600 mt-2">
client/src/pages/admin/AIChat.tsx:1355:                <p className="text-xs text-amber-600 mt-2">
client/src/pages/admin/CreateExam.tsx:233:                  <p className="text-sm text-red-600">{errors.title.message}</p>
client/src/pages/admin/CreateExam.tsx:304:                  <p className="text-sm text-red-600">{errors.duration.message}</p>
client/src/pages/admin/CreateExam.tsx:317:                    <p className="text-sm text-red-600">{errors.startDate.message}</p>
client/src/pages/admin/CreateExam.tsx:329:                    <p className="text-sm text-red-600">{errors.endDate.message}</p>
client/src/pages/admin/CreateExam.tsx:347:                    <p className="text-sm text-red-600">{errors.totalMarks.message}</p>
client/src/pages/admin/CreateExam.tsx:363:                    <p className="text-sm text-red-600">{errors.passingMarks.message}</p>
client/src/pages/admin/CreateExam.tsx:576:                      <p className="text-sm text-red-600">{errors.maxAttempts.message}</p>
client/src/pages/admin/CreateExam.tsx:615:                      <p className="text-sm text-red-600">{errors.questionsPerExam.message}</p>
client/src/pages/admin/EditExam.tsx:254:                  <p className="text-sm text-red-600">{errors.title.message}</p>
client/src/pages/admin/EditExam.tsx:325:                  <p className="text-sm text-red-600">{errors.duration.message}</p>
client/src/pages/admin/EditExam.tsx:338:                    <p className="text-sm text-red-600">{errors.startDate.message}</p>
client/src/pages/admin/EditExam.tsx:350:                    <p className="text-sm text-red-600">{errors.endDate.message}</p>
client/src/pages/admin/EditExam.tsx:368:                    <p className="text-sm text-red-600">{errors.totalMarks.message}</p>
client/src/pages/admin/EditExam.tsx:384:                    <p className="text-sm text-red-600">{errors.passingMarks.message}</p>
client/src/pages/admin/EditExam.tsx:590:                      <p className="text-sm text-red-600">{errors.maxAttempts.message}</p>
client/src/pages/admin/EditExam.tsx:629:                      <p className="text-sm text-red-600">{errors.questionsPerExam.message}</p>
client/src/pages/admin/ExamDetails.tsx:45:        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
client/src/pages/admin/ExamDetails.tsx:49:        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Completed</Badge>
client/src/pages/admin/ExamManagement.tsx:98:        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
client/src/pages/admin/ExamManagement.tsx:102:        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Completed</Badge>
client/src/pages/admin/ExamManagement.tsx:240:                                  className="text-red-600 focus:text-red-600"
client/src/pages/admin/ExamManagement.tsx:259:                                    className="bg-red-600 hover:bg-red-700"
client/src/pages/admin/ExamQuestions.tsx:139:        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Easy</Badge>
client/src/pages/admin/ExamQuestions.tsx:141:        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>
client/src/pages/admin/ExamQuestions.tsx:143:        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Hard</Badge>
client/src/pages/admin/ExamQuestions.tsx:261:                <span className="text-orange-600">Unsaved changes</span>
client/src/pages/admin/QuestionManagement.tsx:307:        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Easy</Badge>
client/src/pages/admin/QuestionManagement.tsx:309:        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>
client/src/pages/admin/QuestionManagement.tsx:311:        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Hard</Badge>
client/src/pages/admin/QuestionManagement.tsx:495:                              className="text-red-600 focus:text-red-600"
client/src/pages/admin/QuestionManagement.tsx:596:        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Easy</Badge>
client/src/pages/admin/QuestionManagement.tsx:598:        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Medium</Badge>
client/src/pages/admin/QuestionManagement.tsx:600:        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Hard</Badge>
client/src/pages/admin/QuestionManagement.tsx:651:                    ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
client/src/pages/admin/QuestionManagement.tsx:820:          className={validationErrors.question ? "border-red-500" : ""}
client/src/pages/admin/QuestionManagement.tsx:823:          <p className="text-sm text-red-500">{validationErrors.question}</p>
client/src/pages/admin/QuestionManagement.tsx:865:            className={validationErrors.marks ? "border-red-500" : ""}
client/src/pages/admin/QuestionManagement.tsx:868:            <p className="text-sm text-red-500">{validationErrors.marks}</p>
client/src/pages/admin/QuestionManagement.tsx:886:                className={index < 4 ? "border-blue-200" : ""}
client/src/pages/admin/QuestionManagement.tsx:910:            <p className="text-sm text-red-500">{validationErrors.options}</p>
client/src/pages/admin/QuestionManagement.tsx:913:            <p className="text-sm text-red-500">{validationErrors.correctAnswers}</p>
client/src/pages/admin/QuestionManagement.tsx:922:            <SelectTrigger className={validationErrors.trueFalseAnswer ? "border-red-500" : ""}>
client/src/pages/admin/QuestionManagement.tsx:931:            <p className="text-sm text-red-500">{validationErrors.trueFalseAnswer}</p>
client/src/pages/admin/QuestionManagement.tsx:945:            className={validationErrors.theoryAnswer ? "border-red-500" : ""}
client/src/pages/admin/QuestionManagement.tsx:948:            <p className="text-sm text-red-500">{validationErrors.theoryAnswer}</p>
client/src/pages/admin/QuestionManagement.tsx:1097:                className={index < 4 ? "border-blue-200" : ""}
client/src/pages/admin/Reports.tsx:209:    if (rate >= 90) return <Badge className="bg-green-600">Excellent</Badge>
client/src/pages/admin/Reports.tsx:210:    if (rate >= 80) return <Badge className="bg-blue-500">Good</Badge>
client/src/pages/admin/Reports.tsx:211:    if (rate >= 70) return <Badge className="bg-yellow-500">Average</Badge>
client/src/pages/admin/Reports.tsx:212:    return <Badge className="bg-red-500">Needs Attention</Badge>
client/src/pages/admin/Reports.tsx:216:    if (!rating || rating <= 2) return "text-green-600"
client/src/pages/admin/Reports.tsx:217:    if (rating <= 3) return "text-yellow-600"
client/src/pages/admin/Reports.tsx:218:    return "text-red-600"
client/src/pages/admin/Reports.tsx:280:        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
client/src/pages/admin/Reports.tsx:283:            <BarChart3 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
client/src/pages/admin/Reports.tsx:286:            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{examReports.length}</div>
client/src/pages/admin/Reports.tsx:287:            <p className="text-xs text-blue-600 dark:text-blue-400">
client/src/pages/admin/Reports.tsx:293:        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
client/src/pages/admin/Reports.tsx:296:            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
client/src/pages/admin/Reports.tsx:299:            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
client/src/pages/admin/Reports.tsx:304:            <p className="text-xs text-green-600 dark:text-green-400">
client/src/pages/admin/Reports.tsx:310:        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
client/src/pages/admin/Reports.tsx:313:            <BookOpen className="h-4 w-4 text-purple-600 dark:text-purple-400" />
client/src/pages/admin/Reports.tsx:316:            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{questionAnalysis.length}</div>
client/src/pages/admin/Reports.tsx:317:            <p className="text-xs text-purple-600 dark:text-purple-400">
client/src/pages/admin/Reports.tsx:323:        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
client/src/pages/admin/Reports.tsx:326:            <Award className="h-4 w-4 text-orange-600 dark:text-orange-400" />
client/src/pages/admin/Reports.tsx:329:            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
client/src/pages/admin/Reports.tsx:334:            <p className="text-xs text-orange-600 dark:text-orange-400">
client/src/pages/admin/Reports.tsx:499:              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
client/src/pages/admin/Reports.tsx:501:                  <div className="text-2xl font-bold text-blue-700">{examStudentReport.statistics.totalStudents}</div>
client/src/pages/admin/Reports.tsx:502:                  <p className="text-sm text-blue-600">Total Students</p>
client/src/pages/admin/Reports.tsx:505:              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
client/src/pages/admin/Reports.tsx:507:                  <div className="text-2xl font-bold text-green-700">{examStudentReport.statistics.passedStudents}</div>
client/src/pages/admin/Reports.tsx:508:                  <p className="text-sm text-green-600">Passed</p>
client/src/pages/admin/Reports.tsx:511:              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
client/src/pages/admin/Reports.tsx:513:                  <div className="text-2xl font-bold text-red-700">{examStudentReport.statistics.failedStudents}</div>
client/src/pages/admin/Reports.tsx:514:                  <p className="text-sm text-red-600">Failed</p>
client/src/pages/admin/Reports.tsx:517:              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
client/src/pages/admin/Reports.tsx:519:                  <div className="text-2xl font-bold text-orange-700">{examStudentReport.statistics.passRate.toFixed(1)}%</div>
client/src/pages/admin/Reports.tsx:520:                  <p className="text-sm text-orange-600">Pass Rate</p>
client/src/pages/admin/Reports.tsx:646:                <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
client/src/pages/admin/Reports.tsx:648:                    <div className="text-2xl font-bold text-purple-700">{performanceAnalysis.overallStats.averageScore.toFixed(1)}%</div>
client/src/pages/admin/Reports.tsx:649:                    <p className="text-sm text-purple-600">Average Score</p>
client/src/pages/admin/Reports.tsx:652:                <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
client/src/pages/admin/Reports.tsx:654:                    <div className="text-2xl font-bold text-green-700">{performanceAnalysis.overallStats.highestScore}%</div>
client/src/pages/admin/Reports.tsx:655:                    <p className="text-sm text-green-600">Highest Score</p>
client/src/pages/admin/Reports.tsx:658:                <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
client/src/pages/admin/Reports.tsx:660:                    <div className="text-2xl font-bold text-blue-700">{performanceAnalysis.overallStats.passRate.toFixed(1)}%</div>
client/src/pages/admin/Reports.tsx:661:                    <p className="text-sm text-blue-600">Pass Rate</p>
client/src/pages/admin/Reports.tsx:664:                <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
client/src/pages/admin/Reports.tsx:666:                    <div className="text-2xl font-bold text-orange-700">{performanceAnalysis.overallStats.averageTimeSpent}m</div>
client/src/pages/admin/Reports.tsx:667:                    <p className="text-sm text-orange-600">Avg Time</p>
client/src/pages/admin/Reports.tsx:731:                        <TableCell className="text-green-600 font-medium">{question.correctAnswers}</TableCell>
client/src/pages/admin/SettingsPage.tsx:423:        return <CheckCircle className="h-4 w-4 text-green-500" />
client/src/pages/admin/SettingsPage.tsx:425:        return <XCircle className="h-4 w-4 text-red-500" />
client/src/pages/admin/SettingsPage.tsx:427:        return <AlertCircle className="h-4 w-4 text-gray-400" />
client/src/pages/admin/SettingsPage.tsx:663:                              className="text-red-600"
client/src/pages/admin/SettingsPage.tsx:951:                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
client/src/pages/admin/SettingsPage.tsx:953:                            <XCircle className="h-4 w-4 text-red-500 mt-0.5 mr-2 shrink-0" />
client/src/pages/admin/SettingsPage.tsx:955:                              <div className="font-medium text-red-800 text-sm">Test Error</div>
client/src/pages/admin/SettingsPage.tsx:956:                              <div className="text-red-700 text-sm mt-1">{platform.testError}</div>
client/src/pages/admin/StudentManagement.tsx:142:      ? <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Active</Badge>
client/src/pages/admin/StudentManagement.tsx:147:    if (score >= 90) return <Badge className="bg-green-600">Excellent</Badge>
client/src/pages/admin/StudentManagement.tsx:148:    if (score >= 80) return <Badge className="bg-blue-500">Good</Badge>
client/src/pages/admin/StudentManagement.tsx:149:    if (score >= 70) return <Badge className="bg-yellow-500">Average</Badge>
client/src/pages/admin/StudentManagement.tsx:150:    return <Badge className="bg-red-500">Needs Improvement</Badge>
client/src/pages/admin/StudentManagement.tsx:299:          <Card key={group._id} className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
client/src/pages/admin/StudentManagement.tsx:301:              <CardTitle className="text-sm font-medium text-blue-700 dark:text-blue-300">
client/src/pages/admin/StudentManagement.tsx:306:              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mb-1">
client/src/pages/admin/StudentManagement.tsx:309:              <p className="text-xs text-blue-600 dark:text-blue-400">
client/src/pages/admin/StudentManagement.tsx:421:                            <DropdownMenuItem className="text-red-600 focus:text-red-600">
client/src/pages/admin/StudentVideoReview.tsx:378:                      <div className="text-2xl font-bold text-orange-600">
client/src/pages/admin/StudentVideoReview.tsx:384:                      <div className="text-2xl font-bold text-yellow-600">
client/src/pages/admin/Subjects.tsx:303:                          className={subject.isActive ? "bg-green-100 text-green-800" : ""}
client/src/pages/admin/Subjects.tsx:332:                              className="text-red-600"
client/src/pages/Login.tsx:49:    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
client/src/pages/Login.tsx:67:        {/* <Alert className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
client/src/pages/Login.tsx:68:          <Info className="h-4 w-4 text-blue-600" />
client/src/pages/Login.tsx:69:          <AlertDescription className="text-blue-800 dark:text-blue-200">
client/src/pages/Login.tsx:71:            <Link to="/seeding" className="underline font-medium hover:text-blue-900">
client/src/pages/Login.tsx:134:                    className="flex items-center gap-1 text-sm bg-blue-100 hover:bg-blue-200 dark:bg-blue-900 dark:hover:bg-blue-800 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-md transition-colors"
client/src/pages/Login.tsx:146:        {/* <Card className="bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
client/src/pages/student/ExamAttempt.tsx:456:    if (percentage <= 10) return "text-red-600"
client/src/pages/student/ExamAttempt.tsx:457:    if (percentage <= 25) return "text-orange-600"
client/src/pages/student/ExamAttempt.tsx:458:    return "text-green-600"
client/src/pages/student/ExamAttempt.tsx:585:                        isAnswered ? "bg-green-100 border-green-300" : ""
client/src/pages/student/ExamAttempt.tsx:586:                      } ${isFlagged ? "bg-yellow-100 border-yellow-300" : ""}`}
client/src/pages/student/ExamAttempt.tsx:591:                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-yellow-600" />
client/src/pages/student/ExamAttempt.tsx:594:                        <CheckCircle className="absolute -bottom-1 -right-1 h-3 w-3 text-green-600" />
client/src/pages/student/ExamAttempt.tsx:616:                    className={flaggedQuestions.has(currentQuestion._id) ? "bg-yellow-100" : ""}
client/src/pages/student/ExamInstructions.tsx:324:                    <div className="flex items-center gap-2 text-orange-600">
client/src/pages/student/ExamInstructions.tsx:332:                    <div className="flex items-center gap-2 text-green-600">
client/src/pages/student/ExamInstructions.tsx:340:                    <div className="flex items-center gap-2 text-red-600">
client/src/pages/student/ExamInstructions.tsx:413:                  <div className={`w-2 h-2 rounded-full ${systemCheck.browser ? 'bg-green-500' : 'bg-red-500'}`} />
client/src/pages/student/ExamInstructions.tsx:417:                  <CheckCircle2 className="h-4 w-4 text-green-500" />
client/src/pages/student/ExamInstructions.tsx:419:                  <AlertTriangle className="h-4 w-4 text-red-500" />
client/src/pages/student/ExamInstructions.tsx:425:                  <div className={`w-2 h-2 rounded-full ${systemCheck.javascript ? 'bg-green-500' : 'bg-red-500'}`} />
client/src/pages/student/ExamInstructions.tsx:429:                  <CheckCircle2 className="h-4 w-4 text-green-500" />
client/src/pages/student/ExamInstructions.tsx:431:                  <AlertTriangle className="h-4 w-4 text-red-500" />
client/src/pages/student/ExamInstructions.tsx:439:                      ? 'bg-gray-400'
client/src/pages/student/ExamInstructions.tsx:440:                      : systemCheck.fullScreen ? 'bg-green-500' : 'bg-red-500'
client/src/pages/student/ExamInstructions.tsx:448:                  <CheckCircle2 className="h-4 w-4 text-gray-400" />
client/src/pages/student/ExamInstructions.tsx:450:                  <CheckCircle2 className="h-4 w-4 text-green-500" />
client/src/pages/student/ExamInstructions.tsx:452:                  <AlertTriangle className="h-4 w-4 text-red-500" />
client/src/pages/student/ExamInstructions.tsx:458:                  <div className={`w-2 h-2 rounded-full ${systemCheck.connection ? 'bg-green-500' : 'bg-red-500'}`} />
client/src/pages/student/ExamInstructions.tsx:462:                  <CheckCircle2 className="h-4 w-4 text-green-500" />
client/src/pages/student/ExamInstructions.tsx:464:                  <AlertTriangle className="h-4 w-4 text-red-500" />
client/src/pages/student/ExamInstructions.tsx:482:                  <div className={`w-2 h-2 rounded-full ${exam.mobileEnabled ? 'bg-green-500' : 'bg-gray-400'}`} />
client/src/pages/student/ExamInstructions.tsx:486:                  <Badge variant="outline" className="text-green-600 border-green-600">Enabled</Badge>
client/src/pages/student/ExamInstructions.tsx:488:                  <Badge variant="outline" className="text-gray-600">Disabled</Badge>
client/src/pages/student/ExamInstructions.tsx:493:                <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
client/src/pages/student/ExamInstructions.tsx:494:                  <div className="flex items-center gap-2 text-orange-700">
client/src/pages/student/ExamInstructions.tsx:498:                  <p className="text-xs text-orange-600 mt-1">
client/src/pages/student/ExamInstructions.tsx:505:                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
client/src/pages/student/ExamInstructions.tsx:506:                  <div className="flex items-center gap-2 text-red-700">
client/src/pages/student/ExamInstructions.tsx:510:                  <p className="text-xs text-red-600 mt-1">
client/src/pages/student/MobileExamAttempt.tsx:218:            <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
client/src/pages/student/MobileExamAttempt.tsx:292:                          ? "bg-green-100 text-green-800 border-2 border-green-300"
client/src/pages/student/MobileExamAttempt.tsx:303:                <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-300" />
client/src/pages/student/MobileExamAttempt.tsx:460:              <AlertTriangle className="h-5 w-5 text-yellow-500" />
client/src/pages/student/MobileExamAttempt.tsx:472:                  <span className="font-semibold text-green-600">
client/src/pages/student/MobileExamAttempt.tsx:478:                  <span className="font-semibold text-red-600">
client/src/pages/student/MobileExamAttempt.tsx:484:                <p className="text-yellow-600 text-sm">
client/src/pages/student/StudentDashboard.tsx:140:            <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
client/src/pages/student/StudentDashboard.tsx:143:                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
client/src/pages/student/StudentDashboard.tsx:146:                <div className="text-3xl font-bold text-blue-700 dark:text-blue-300">{stats.availableExams}</div>
client/src/pages/student/StudentDashboard.tsx:147:                <p className="text-xs text-blue-600 dark:text-blue-400">
client/src/pages/student/StudentDashboard.tsx:153:            <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
client/src/pages/student/StudentDashboard.tsx:156:                <Trophy className="h-4 w-4 text-green-600 dark:text-green-400" />
client/src/pages/student/StudentDashboard.tsx:159:                <div className="text-3xl font-bold text-green-700 dark:text-green-300">{stats.completedExams}</div>
client/src/pages/student/StudentDashboard.tsx:160:                <p className="text-xs text-green-600 dark:text-green-400">
client/src/pages/student/StudentDashboard.tsx:200:                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-200">
client/src/pages/student/StudentDashboard.tsx:255:                              result.percentage >= 80 ? 'bg-green-100 text-green-700 hover:bg-green-200' :
client/src/pages/student/StudentDashboard.tsx:256:                              result.percentage >= 60 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
client/src/pages/student/StudentDashboard.tsx:257:                              'bg-red-100 text-red-700 hover:bg-red-200'
client/src/pages/student/StudentDashboard.tsx:291:          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
client/src/pages/student/StudentDashboard.tsx:293:              <CardTitle className="text-purple-800">📚 Quick Tips for Success</CardTitle>
client/src/pages/student/StudentDashboard.tsx:298:                  <Clock className="h-4 w-4 text-purple-600 mt-0.5" />
client/src/pages/student/StudentDashboard.tsx:300:                    <p className="font-medium text-purple-800">Manage Your Time</p>
client/src/pages/student/StudentDashboard.tsx:301:                    <p className="text-purple-600">Keep an eye on the timer and pace yourself</p>
client/src/pages/student/StudentDashboard.tsx:305:                  <BookOpen className="h-4 w-4 text-purple-600 mt-0.5" />
client/src/pages/student/StudentDashboard.tsx:307:                    <p className="font-medium text-purple-800">Read Carefully</p>
client/src/pages/student/StudentDashboard.tsx:308:                    <p className="text-purple-600">Take time to understand each question</p>
client/src/pages/student/StudentDashboard.tsx:312:                  <Award className="h-4 w-4 text-purple-600 mt-0.5" />
client/src/pages/student/StudentDashboard.tsx:314:                    <p className="font-medium text-purple-800">Stay Focused</p>
client/src/pages/student/StudentDashboard.tsx:315:                    <p className="text-purple-600">Minimize distractions during exams</p>
client/src/pages/student/StudentResults.tsx:52:    if (percentage >= 90) return <Badge className="bg-green-600">A+</Badge>
client/src/pages/student/StudentResults.tsx:53:    if (percentage >= 80) return <Badge className="bg-green-500">A</Badge>
client/src/pages/student/StudentResults.tsx:54:    if (percentage >= 70) return <Badge className="bg-blue-500">B</Badge>
client/src/pages/student/StudentResults.tsx:55:    if (percentage >= 60) return <Badge className="bg-yellow-500">C</Badge>
client/src/pages/student/StudentResults.tsx:56:    if (percentage >= 50) return <Badge className="bg-orange-500">D</Badge>
client/src/pages/student/StudentResults.tsx:61:    if (percentage >= 85) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">Excellent</Badge>
client/src/pages/student/StudentResults.tsx:62:    if (percentage >= 70) return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300">Good</Badge>
client/src/pages/student/StudentResults.tsx:63:    if (percentage >= 60) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">Average</Badge>
client/src/pages/student/StudentResults.tsx:64:    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300">Needs Improvement</Badge>
client/src/pages/student/StudentResults.tsx:95:        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
client/src/pages/student/StudentResults.tsx:98:            <BookOpen className="h-4 w-4 text-blue-600 dark:text-blue-400" />
client/src/pages/student/StudentResults.tsx:101:            <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{completedAttempts.length}</div>
client/src/pages/student/StudentResults.tsx:102:            <p className="text-xs text-blue-600 dark:text-blue-400">
client/src/pages/student/StudentResults.tsx:108:        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
client/src/pages/student/StudentResults.tsx:111:            <Target className="h-4 w-4 text-green-600 dark:text-green-400" />
client/src/pages/student/StudentResults.tsx:114:            <div className="text-2xl font-bold text-green-700 dark:text-green-300">
client/src/pages/student/StudentResults.tsx:117:            <p className="text-xs text-green-600 dark:text-green-400">
client/src/pages/student/StudentResults.tsx:123:        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
client/src/pages/student/StudentResults.tsx:126:            <Trophy className="h-4 w-4 text-purple-600 dark:text-purple-400" />
client/src/pages/student/StudentResults.tsx:129:            <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
client/src/pages/student/StudentResults.tsx:132:            <p className="text-xs text-purple-600 dark:text-purple-400">
client/src/pages/student/StudentResults.tsx:138:        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
client/src/pages/student/StudentResults.tsx:141:            <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
client/src/pages/student/StudentResults.tsx:144:            <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
client/src/pages/student/StudentResults.tsx:147:            <p className="text-xs text-orange-600 dark:text-orange-400">
client/src/components/AIChatQuestionAssignment.tsx:157:      <Card className="mt-4 border-green-200 bg-green-50">
client/src/components/AIChatQuestionAssignment.tsx:159:          <div className="flex items-center justify-center space-x-2 text-green-700">
client/src/components/AIChatQuestionAssignment.tsx:170:      <Card className="mt-4 border-blue-200 bg-blue-50">
client/src/components/AIChatQuestionAssignment.tsx:172:          <CardTitle className="flex items-center gap-2 text-blue-800">
client/src/components/AIChatQuestionAssignment.tsx:176:          <CardDescription className="text-blue-700">
client/src/components/AIChatQuestionAssignment.tsx:184:              className="bg-blue-600 hover:bg-blue-700"
client/src/components/AIChatQuestionAssignment.tsx:191:              className="border-blue-300 text-blue-700 hover:bg-blue-100"
client/src/components/AIChatQuestionAssignment.tsx:203:      <Card className="mt-4 border-blue-200 bg-blue-50">
client/src/components/AIChatQuestionAssignment.tsx:205:          <CardTitle className="flex items-center gap-2 text-blue-800">
client/src/components/AIChatQuestionAssignment.tsx:209:          <CardDescription className="text-blue-700">
client/src/components/AIChatQuestionAssignment.tsx:218:              className="bg-blue-600 hover:bg-blue-700"
client/src/components/AIChatQuestionAssignment.tsx:227:              className="border-blue-300 text-blue-700 hover:bg-blue-100"
client/src/components/AIChatQuestionAssignment.tsx:237:                className="text-gray-600 hover:bg-gray-100"
client/src/components/AIChatQuestionAssignment.tsx:250:      <Card className="mt-4 border-blue-200 bg-blue-50">
client/src/components/AIChatQuestionAssignment.tsx:252:          <div className="flex items-center justify-center space-x-2 text-blue-700">
client/src/components/AIChatQuestionAssignment.tsx:253:            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-700"></div>
client/src/components/CreateExamModal.tsx:262:                    <p className="text-sm text-red-600 mt-1">{errors.title.message}</p>
client/src/components/CreateExamModal.tsx:295:                    <p className="text-sm text-red-600 mt-1">{errors.subject.message}</p>
client/src/components/CreateExamModal.tsx:313:                    <p className="text-sm text-red-600 mt-1">{errors.duration.message}</p>
client/src/components/CreateExamModal.tsx:338:                    <p className="text-sm text-red-600 mt-1">{errors.startDate.message}</p>
client/src/components/CreateExamModal.tsx:351:                    <p className="text-sm text-red-600 mt-1">{errors.startTime.message}</p>
client/src/components/CreateExamModal.tsx:364:                    <p className="text-sm text-red-600 mt-1">{errors.endDate.message}</p>
client/src/components/CreateExamModal.tsx:377:                    <p className="text-sm text-red-600 mt-1">{errors.endTime.message}</p>
client/src/components/CreateExamModal.tsx:406:                    <p className="text-sm text-red-600 mt-1">{errors.totalMarks.message}</p>
client/src/components/CreateExamModal.tsx:423:                    <p className="text-sm text-red-600 mt-1">{errors.passingMarks.message}</p>
client/src/components/CreateExamModal.tsx:452:                        <p className="text-sm text-red-600 mt-1">{errors.negativeMarkingValue.message}</p>
client/src/components/CreateExamModal.tsx:483:                        <p className="text-sm text-red-600 mt-1">{errors.maxAttempts.message}</p>
client/src/components/CreateExamModal.tsx:598:                        <p className="text-sm text-red-600 mt-1">{errors.questionsPerExam.message}</p>
client/src/components/ExamSelectionModal.tsx:120:        return 'bg-gray-100 text-gray-700 border-gray-300'
client/src/components/ExamSelectionModal.tsx:122:        return 'bg-green-100 text-green-700 border-green-300'
client/src/components/ExamSelectionModal.tsx:124:        return 'bg-blue-100 text-blue-700 border-blue-300'
client/src/components/ExamSelectionModal.tsx:126:        return 'bg-orange-100 text-orange-700 border-orange-300'
client/src/components/ExamSelectionModal.tsx:128:        return 'bg-gray-100 text-gray-700 border-gray-300'
client/src/components/ExamSelectionModal.tsx:159:        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
client/src/components/ExamSelectionModal.tsx:172:              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
client/src/components/ExamSelectionModal.tsx:173:              <span className="ml-2 text-gray-600">Loading exams...</span>
client/src/components/ExamSelectionModal.tsx:179:            <div className="text-center py-8 text-gray-500">
client/src/components/ExamSelectionModal.tsx:202:                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
client/src/components/ExamSelectionModal.tsx:203:                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
client/src/components/ExamSelectionModal.tsx:211:                        <p className="text-gray-600 text-sm line-clamp-2 mb-2">
client/src/components/ExamSelectionModal.tsx:223:                    <div className="flex items-center gap-4 text-sm text-gray-500 mb-2">
client/src/components/ExamSelectionModal.tsx:238:                    <div className="flex items-center gap-4 text-xs text-gray-400">
client/src/components/IntentConfirmationDialog.tsx:33:        return <BookOpen className="h-6 w-6 text-blue-500" />
client/src/components/IntentConfirmationDialog.tsx:35:        return <FileText className="h-6 w-6 text-green-500" />
client/src/components/SubjectForm.tsx:129:            Subject Name <span className="text-red-500">*</span>
client/src/components/SubjectForm.tsx:146:            Subject Code <span className="text-red-500">*</span>
client/src/components/ui/toast.tsx:107:      "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100 group-[.destructive]:text-red-300 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus:ring-red-400 group-[.destructive]:focus:ring-offset-red-600",
client/src/components/VideoRecorder.tsx:378:      className={`fixed bg-white border border-gray-200 rounded-lg shadow-lg z-50 ${
client/src/components/VideoRecorder.tsx:390:        className="flex items-center justify-between p-3 bg-gray-50 rounded-t-lg cursor-grab active:cursor-grabbing border-b"
client/src/components/VideoRecorder.tsx:394:          <Move className="h-4 w-4 text-gray-500" />
client/src/components/VideoRecorder.tsx:424:              <div className="absolute top-1 right-1 flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded text-xs">
client/src/components/VideoRecorder.tsx:460:          <div className="text-xs text-center text-gray-600">
client/src/components/VideoRecorder.tsx:468:              <p className="text-green-600">Recording completed ✓</p>
client/src/components/VideoRecorder.tsx:476:        <div className="px-3 py-2 text-xs text-center text-gray-600">
```

## Affected files (25)

- `client/src/components/AIChatQuestionAssignment.tsx`
- `client/src/components/CreateExamModal.tsx`
- `client/src/components/ExamSelectionModal.tsx`
- `client/src/components/IntentConfirmationDialog.tsx`
- `client/src/components/SubjectForm.tsx`
- `client/src/components/VideoRecorder.tsx`
- `client/src/components/ui/toast.tsx`
- `client/src/pages/Login.tsx`
- `client/src/pages/admin/AIChat.tsx`
- `client/src/pages/admin/AdminDashboard.tsx`
- `client/src/pages/admin/CreateExam.tsx`
- `client/src/pages/admin/EditExam.tsx`
- `client/src/pages/admin/ExamDetails.tsx`
- `client/src/pages/admin/ExamManagement.tsx`
- `client/src/pages/admin/ExamQuestions.tsx`
- `client/src/pages/admin/QuestionManagement.tsx`
- `client/src/pages/admin/Reports.tsx`
- `client/src/pages/admin/SettingsPage.tsx`
- `client/src/pages/admin/StudentManagement.tsx`
- `client/src/pages/admin/StudentVideoReview.tsx`
- `client/src/pages/admin/Subjects.tsx`
- `client/src/pages/student/ExamAttempt.tsx`
- `client/src/pages/student/ExamInstructions.tsx`
- `client/src/pages/student/MobileExamAttempt.tsx`
- `client/src/pages/student/StudentDashboard.tsx`
- `client/src/pages/student/StudentResults.tsx`

Note: the original spec estimated ~26 files from an earlier exploratory pass; this re-run (same query, run from the shell phase's actual working tree) found 25 — a trivial discrepancy from an informal earlier count, not a sign anything changed.

## Patterns worth flagging to whoever picks these up

- **Colored stat-card gradients** (`AdminDashboard.tsx`, `Reports.tsx`, `StudentDashboard.tsx`, `StudentResults.tsx`, `StudentManagement.tsx`): the same `bg-gradient-to-br from-{color}-50 to-{color}-100 ... border-{color}-200` blue/green/purple/orange pattern repeats across five files for "stat card" tiles. This is the single highest-value fix — likely worth its own small shared component (e.g. `StatCard`) rather than four ad hoc token swaps.
- **Grade/status `Badge` coloring** (`ExamDetails.tsx`, `ExamManagement.tsx`, `ExamQuestions.tsx`, `QuestionManagement.tsx`, `StudentManagement.tsx`, `StudentResults.tsx`, `Reports.tsx`): hardcoded green/blue/yellow/red badges for Active/Completed/Easy/Medium/Hard/grades — this is exactly what the new `StatusBadge` component (from the shell phase) was built to replace.
- **Form validation error text** (`CreateExam.tsx`, `EditExam.tsx`, `CreateExamModal.tsx`, `QuestionManagement.tsx`, `SubjectForm.tsx`): repeated `text-red-600`/`text-red-500` on error messages — should become `text-destructive`.
- **System-check indicator dots** (`ExamInstructions.tsx`): `bg-green-500`/`bg-red-500`/`bg-gray-400` traffic-light dots — candidate for the `StatusBadge` treatment or a small dedicated indicator component.
- **`Login.tsx`** is out of scope for both this audit's fixes and the shell phase generally — it's handled by the Auth phase, which redesigns the page anyway.
