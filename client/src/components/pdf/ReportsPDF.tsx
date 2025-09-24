import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Font,
} from '@react-pdf/renderer';

// Define styles for PDF
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 20,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: '3px solid #2563EB',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginVertical: 20,
    gap: 10,
  },
  summaryCard: {
    backgroundColor: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: 15,
    width: '48%',
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 5,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#6B7280',
  },
  section: {
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 15,
    paddingLeft: 12,
    borderLeft: '4px solid #2563EB',
  },
  table: {
    marginVertical: 10,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    padding: 8,
    borderBottom: '1px solid #E5E7EB',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottom: '1px solid #E5E7EB',
  },
  tableCell: {
    flex: 1,
    fontSize: 10,
    color: '#374151',
    paddingHorizontal: 4,
  },
  tableCellHeader: {
    flex: 1,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#374151',
    paddingHorizontal: 4,
  },
  examInfo: {
    backgroundColor: '#F3F4F6',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  examInfoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  examInfoItem: {
    width: '48%',
    marginBottom: 8,
  },
  examInfoLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#6B7280',
    marginBottom: 2,
  },
  examInfoValue: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  statsCard: {
    width: '23%',
    backgroundColor: '#F0F9FF',
    border: '1px solid #BAE6FD',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  statsValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0369A1',
    marginBottom: 2,
  },
  statsLabel: {
    fontSize: 9,
    color: '#0369A1',
  },
  scoreDistGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 15,
  },
  scoreDistCard: {
    width: '15%',
    backgroundColor: '#FFFFFF',
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  scoreDistValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2563EB',
    marginBottom: 2,
  },
  scoreDistLabel: {
    fontSize: 8,
    color: '#6B7280',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    textAlign: 'center',
    borderTop: '1px solid #E5E7EB',
    paddingTop: 10,
  },
  footerText: {
    fontSize: 10,
    color: '#6B7280',
  },
});

interface ReportsPDFProps {
  reportData: {
    selectedReport: string;
    selectedExam: string;
    examReports: any[];
    questionAnalysis: any[];
    examStudentReport: any;
    performanceAnalysis: any;
    exams: any[];
    generatedAt: string;
  };
}

export const ReportsPDF: React.FC<ReportsPDFProps> = ({ reportData }) => {
  const {
    selectedReport,
    selectedExam,
    examReports,
    questionAnalysis,
    examStudentReport,
    performanceAnalysis,
    exams,
    generatedAt,
  } = reportData;

  const getReportTitle = () => {
    switch (selectedReport) {
      case 'exam-overview':
        return 'Exam Performance Overview';
      case 'question-analysis':
        return 'Question Difficulty Analysis';
      case 'exam-students':
        return examStudentReport ? `Student Scores - ${examStudentReport.exam.title}` : 'Student Scores';
      case 'exam-analysis':
        return performanceAnalysis ? `Performance Analysis - ${performanceAnalysis.examInfo.title}` : 'Performance Analysis';
      default:
        return 'Reports & Analytics';
    }
  };

  // Calculate summary statistics
  const totalExams = examReports.length;
  const avgPassRate = examReports.length > 0
    ? examReports.reduce((sum, report) => sum + report.passRate, 0) / examReports.length
    : 0;
  const totalQuestions = questionAnalysis.length;
  const avgScore = examReports.length > 0
    ? examReports.reduce((sum, report) => sum + report.averageScore, 0) / examReports.length
    : 0;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{getReportTitle()}</Text>
          <Text style={styles.subtitle}>
            Comprehensive insights into exam performance and student progress
          </Text>
          <Text style={styles.subtitle}>
            Generated on {new Date(generatedAt).toLocaleDateString()} at {new Date(generatedAt).toLocaleTimeString()}
          </Text>
        </View>

        {/* Summary Cards */}
        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalExams}</Text>
            <Text style={styles.summaryLabel}>Total Exams</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{avgPassRate.toFixed(1)}%</Text>
            <Text style={styles.summaryLabel}>Average Pass Rate</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{totalQuestions}</Text>
            <Text style={styles.summaryLabel}>Total Questions</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{avgScore.toFixed(1)}%</Text>
            <Text style={styles.summaryLabel}>Avg Score</Text>
          </View>
        </View>

        {/* Report Content */}
        {selectedReport === 'exam-overview' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Exam Performance Overview</Text>
            <Text style={[styles.summaryLabel, { marginBottom: 10 }]}>
              Detailed statistics for each exam conducted
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>Exam</Text>
                <Text style={styles.tableCellHeader}>Students</Text>
                <Text style={styles.tableCellHeader}>Completed</Text>
                <Text style={styles.tableCellHeader}>Avg Score</Text>
                <Text style={styles.tableCellHeader}>Pass Rate</Text>
                <Text style={styles.tableCellHeader}>Avg Time</Text>
              </View>
              {examReports.map((report, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{report.examTitle}</Text>
                  <Text style={styles.tableCell}>{report.totalStudents}</Text>
                  <Text style={styles.tableCell}>{report.completedAttempts}</Text>
                  <Text style={styles.tableCell}>{report.averageScore.toFixed(1)}%</Text>
                  <Text style={styles.tableCell}>{report.passRate.toFixed(1)}%</Text>
                  <Text style={styles.tableCell}>{report.averageTimeSpent}m</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {selectedReport === 'question-analysis' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Question Difficulty Analysis</Text>
            <Text style={[styles.summaryLabel, { marginBottom: 10 }]}>
              Analyze question performance and difficulty ratings
            </Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>Question</Text>
                <Text style={styles.tableCellHeader}>Attempts</Text>
                <Text style={styles.tableCellHeader}>Correct</Text>
                <Text style={styles.tableCellHeader}>Success Rate</Text>
                <Text style={styles.tableCellHeader}>Difficulty</Text>
                <Text style={styles.tableCellHeader}>Avg Time</Text>
              </View>
              {questionAnalysis.map((analysis, index) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>
                    {analysis.question.length > 40
                      ? analysis.question.substring(0, 40) + '...'
                      : analysis.question}
                  </Text>
                  <Text style={styles.tableCell}>{analysis.totalAttempts}</Text>
                  <Text style={styles.tableCell}>{analysis.correctAnswers}</Text>
                  <Text style={styles.tableCell}>
                    {((analysis.correctAnswers / analysis.totalAttempts) * 100).toFixed(1)}%
                  </Text>
                  <Text style={styles.tableCell}>
                    {analysis.difficultyRating ? analysis.difficultyRating.toFixed(1) : 'N/A'}/5
                  </Text>
                  <Text style={styles.tableCell}>{analysis.averageTimeSpent}s</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            ExamMaster Performance Analysis Report - Generated with Claude Code
          </Text>
        </View>
      </Page>

      {/* Additional pages for exam-specific reports */}
      {selectedReport === 'exam-students' && examStudentReport && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Student Scores - {examStudentReport.exam.title}</Text>
            <Text style={styles.subtitle}>Individual student performance for the selected exam</Text>
          </View>

          {/* Exam Info */}
          <View style={styles.examInfo}>
            <View style={styles.examInfoGrid}>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Subject</Text>
                <Text style={styles.examInfoValue}>{examStudentReport.exam.subject}</Text>
              </View>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Total Marks</Text>
                <Text style={styles.examInfoValue}>{examStudentReport.exam.totalMarks}</Text>
              </View>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Passing Marks</Text>
                <Text style={styles.examInfoValue}>{examStudentReport.exam.passingMarks}</Text>
              </View>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Duration</Text>
                <Text style={styles.examInfoValue}>{examStudentReport.exam.duration} min</Text>
              </View>
            </View>
          </View>

          {/* Exam Statistics */}
          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{examStudentReport.statistics.totalStudents}</Text>
              <Text style={styles.statsLabel}>Total Students</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{examStudentReport.statistics.passedStudents}</Text>
              <Text style={styles.statsLabel}>Passed</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{examStudentReport.statistics.failedStudents}</Text>
              <Text style={styles.statsLabel}>Failed</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{examStudentReport.statistics.passRate.toFixed(1)}%</Text>
              <Text style={styles.statsLabel}>Pass Rate</Text>
            </View>
          </View>

          {/* Students Table */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Student Performance</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>Student</Text>
                <Text style={styles.tableCellHeader}>ID</Text>
                <Text style={styles.tableCellHeader}>Group</Text>
                <Text style={styles.tableCellHeader}>Score</Text>
                <Text style={styles.tableCellHeader}>%</Text>
                <Text style={styles.tableCellHeader}>Time</Text>
                <Text style={styles.tableCellHeader}>Status</Text>
                <Text style={styles.tableCellHeader}>Result</Text>
              </View>
              {examStudentReport.studentScores.slice(0, 30).map((student: any, index: number) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>{student.studentName}</Text>
                  <Text style={styles.tableCell}>{student.studentIdNumber}</Text>
                  <Text style={styles.tableCell}>{student.studentGroup}</Text>
                  <Text style={styles.tableCell}>{student.score}</Text>
                  <Text style={styles.tableCell}>{student.percentage.toFixed(1)}%</Text>
                  <Text style={styles.tableCell}>{student.timeSpent}m</Text>
                  <Text style={styles.tableCell}>{student.status}</Text>
                  <Text style={styles.tableCell}>{student.isPassed ? 'Passed' : 'Failed'}</Text>
                </View>
              ))}
            </View>
            {examStudentReport.studentScores.length > 30 && (
              <Text style={[styles.summaryLabel, { marginTop: 10 }]}>
                Showing first 30 students. Total: {examStudentReport.studentScores.length} students
              </Text>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ExamMaster Performance Analysis Report - Generated with Claude Code
            </Text>
          </View>
        </Page>
      )}

      {selectedReport === 'exam-analysis' && performanceAnalysis && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>Performance Analysis - {performanceAnalysis.examInfo.title}</Text>
            <Text style={styles.subtitle}>Comprehensive performance analysis for the selected exam</Text>
          </View>

          {/* Exam Overview */}
          <View style={styles.examInfo}>
            <View style={styles.examInfoGrid}>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Subject</Text>
                <Text style={styles.examInfoValue}>{performanceAnalysis.examInfo.subject}</Text>
              </View>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Questions</Text>
                <Text style={styles.examInfoValue}>{performanceAnalysis.examInfo.totalQuestions}</Text>
              </View>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Total Marks</Text>
                <Text style={styles.examInfoValue}>{performanceAnalysis.examInfo.totalMarks}</Text>
              </View>
              <View style={styles.examInfoItem}>
                <Text style={styles.examInfoLabel}>Duration</Text>
                <Text style={styles.examInfoValue}>{performanceAnalysis.examInfo.duration}m</Text>
              </View>
            </View>
          </View>

          {/* Performance Metrics */}
          <View style={styles.statsGrid}>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{performanceAnalysis.overallStats.averageScore.toFixed(1)}%</Text>
              <Text style={styles.statsLabel}>Average Score</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{performanceAnalysis.overallStats.highestScore}%</Text>
              <Text style={styles.statsLabel}>Highest Score</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{performanceAnalysis.overallStats.passRate.toFixed(1)}%</Text>
              <Text style={styles.statsLabel}>Pass Rate</Text>
            </View>
            <View style={styles.statsCard}>
              <Text style={styles.statsValue}>{performanceAnalysis.overallStats.averageTimeSpent}m</Text>
              <Text style={styles.statsLabel}>Avg Time</Text>
            </View>
          </View>

          {/* Score Distribution */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Score Distribution</Text>
            <View style={styles.scoreDistGrid}>
              {Object.entries(performanceAnalysis.scoreDistribution).map(([range, count]) => (
                <View key={range} style={styles.scoreDistCard}>
                  <Text style={styles.scoreDistValue}>{count as number}</Text>
                  <Text style={styles.scoreDistLabel}>{range}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Question Analysis */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Question-wise Analysis</Text>
            <View style={styles.table}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableCellHeader}>Question</Text>
                <Text style={styles.tableCellHeader}>Type</Text>
                <Text style={styles.tableCellHeader}>Marks</Text>
                <Text style={styles.tableCellHeader}>Success Rate</Text>
                <Text style={styles.tableCellHeader}>Difficulty</Text>
                <Text style={styles.tableCellHeader}>Avg Time</Text>
              </View>
              {performanceAnalysis.questionAnalysis.slice(0, 15).map((question: any, index: number) => (
                <View key={index} style={styles.tableRow}>
                  <Text style={styles.tableCell}>
                    {question.questionText.length > 30
                      ? question.questionText.substring(0, 30) + '...'
                      : question.questionText}
                  </Text>
                  <Text style={styles.tableCell}>{question.type}</Text>
                  <Text style={styles.tableCell}>{question.marks}</Text>
                  <Text style={styles.tableCell}>{question.successRate.toFixed(1)}%</Text>
                  <Text style={styles.tableCell}>
                    {question.difficultyRating ? question.difficultyRating.toFixed(1) : 'N/A'}/5
                  </Text>
                  <Text style={styles.tableCell}>{question.averageTimeSpent}s</Text>
                </View>
              ))}
            </View>
            {performanceAnalysis.questionAnalysis.length > 15 && (
              <Text style={[styles.summaryLabel, { marginTop: 10 }]}>
                Showing first 15 questions. Total: {performanceAnalysis.questionAnalysis.length} questions
              </Text>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ExamMaster Performance Analysis Report - Generated with Claude Code
            </Text>
          </View>
        </Page>
      )}
    </Document>
  );
};