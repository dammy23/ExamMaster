import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoadingState } from "@/components/ui/loading-state";
import { EmptyState } from "@/components/ui/empty-state";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Send,
  AlertTriangle,
  CheckCircle,
  Menu,
  X,
} from "lucide-react";
import {
  startExamAttempt,
  saveExamAnswer,
  submitExamAttempt,
  type ExamQuestion,
} from "@/api/examAttempts";
import { getExamById } from "@/api/exams";
import { useToast } from "@/hooks/useToast";

export function MobileExamAttempt() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [exam, setExam] = useState<any>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<{
    [questionId: string]: string | string[];
  }>({});
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [attemptId, setAttemptId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showNavigation, setShowNavigation] = useState(false);

  useEffect(() => {
    if (id) {
      initializeExam();
    }

    // Prevent page refresh/close
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue =
        "Are you sure you want to leave? Your exam progress may be lost.";
      return "Are you sure you want to leave?";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [id]);

  // Timer effect
  useEffect(() => {
    if (timeRemaining > 0) {
      const timer = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (timeRemaining === 0 && attemptId && questions.length > 0) {
      handleAutoSubmit();
    }
  }, [timeRemaining]);

  // Auto-save answers
  useEffect(() => {
    if (attemptId && currentQuestion) {
      const answer = answers[currentQuestion._id];
      if (answer !== undefined) {
        saveExamAnswer(attemptId, currentQuestion._id, answer).catch(() => {});
      }
    }
  }, [answers, currentQuestionIndex, attemptId]);

  const initializeExam = async () => {
    try {
      setLoading(true);
      const examResponse = await getExamById(id!);
      setExam(examResponse.exam);

      const attemptResponse = await startExamAttempt(id!);
      setAttemptId(attemptResponse.attemptId);
      setQuestions(attemptResponse.questions);
      setTimeRemaining(
        attemptResponse.remainingTime || examResponse.exam.duration * 60,
      ); // Use remainingTime from attempt or fallback to full duration

      // Pre-populate saved answers
      const savedAnswers: any = {};
      attemptResponse.questions.forEach((q: any) => {
        if (q.studentAnswer !== undefined && q.studentAnswer !== null) {
          savedAnswers[q._id] = q.studentAnswer;
        }
      });
      setAnswers(savedAnswers);

      toast({
        title: "Exam Started",
        description: "Good luck! Remember to submit before time runs out.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to start exam",
        variant: "destructive",
      });
      navigate("/student");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSubmit = async () => {
    try {
      await submitExamAttempt(attemptId);
      toast({
        title: "Time's Up!",
        description: "Your exam has been automatically submitted.",
      });
      navigate("/student/results");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to submit exam automatically",
        variant: "destructive",
      });
    }
  };

  const handleSubmit = async () => {
    try {
      await submitExamAttempt(attemptId);
      toast({
        title: "Success",
        description: "Your exam has been submitted successfully!",
      });
      navigate("/student/results");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit exam",
        variant: "destructive",
      });
    }
  };

  const handleAnswerChange = (
    questionId: string,
    answer: string | string[],
  ) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: answer,
    }));
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().substring(0, 2)}`;
    }
    return `${minutes}:${secs.toString().substring(0, 2)}`;
  };

  const currentQuestion = questions[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100;

  if (loading) {
    return <LoadingState label="Loading exam..." className="min-h-screen" />;
  }

  if (!currentQuestion) {
    return (
      <EmptyState
        icon={AlertTriangle}
        title="No Questions Available"
        description="This exam has no questions."
        action={{ label: "Back to Dashboard", onClick: () => navigate("/student") }}
        className="min-h-screen"
      />
    );
  }

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Fixed Header */}
      <div className="sticky top-0 z-50 bg-background border-b shadow-sm">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold truncate flex-1">{exam?.title}</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowNavigation(!showNavigation)}
              className="ml-2"
            >
              {showNavigation ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-3 text-sm">
            <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full">
              <Clock className="h-4 w-4 text-primary" />
              <span className="font-mono font-semibold">
                {formatTime(timeRemaining)}
              </span>
            </div>
            <div className="flex-1 text-center">
              <span className="font-semibold">{currentQuestionIndex + 1}</span>
              <span className="text-muted-foreground">
                {" "}
                / {questions.length}
              </span>
            </div>
          </div>

          <Progress value={progress} className="h-2 mt-3" />
        </div>

        {/* Navigation Grid */}
        {showNavigation && (
          <div className="p-4 border-t bg-muted/30">
            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto">
              {questions.map((q, idx) => (
                <button
                  key={q._id}
                  onClick={() => {
                    if (exam?.allowReview || idx >= currentQuestionIndex) {
                      setCurrentQuestionIndex(idx);
                      setShowNavigation(false);
                    }
                  }}
                  className={`
                    aspect-square rounded-lg font-semibold text-sm transition-all
                    ${
                      idx === currentQuestionIndex
                        ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2"
                        : answers[q._id] !== undefined
                          ? "bg-status-success/20 text-status-success-foreground border-2 border-status-success"
                          : "bg-background border-2 border-border hover:border-primary/50"
                    }
                  `}
                >
                  {idx + 1}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-status-success/20 border-2 border-status-success" />
                <span>Answered: {answeredCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded bg-background border-2 border-border" />
                <span>Unanswered: {unansweredCount}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Question Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start gap-2 mb-4">
              <Badge variant="outline" className="shrink-0">
                Q{currentQuestionIndex + 1}
              </Badge>
              <div className="flex-1">
                <div
                  className="text-base leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: currentQuestion.question }}
                />
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {currentQuestion.marks}{" "}
                    {currentQuestion.marks === 1 ? "mark" : "marks"}
                  </Badge>
                  <Badge variant="secondary" className="text-xs capitalize">
                    {currentQuestion.difficulty}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Answer Options */}
            <div className="mt-6 space-y-3">
              {currentQuestion.type === "multiple-choice" && (
                <RadioGroup
                  value={(answers[currentQuestion._id] as string) || ""}
                  onValueChange={(value) =>
                    handleAnswerChange(currentQuestion._id, value)
                  }
                >
                  {currentQuestion.options?.map((option, idx) => (
                    <div
                      key={idx}
                      className="flex items-start space-x-3 p-3 border rounded-lg hover:border-primary/50 transition-colors"
                    >
                      <RadioGroupItem
                        value={option}
                        id={`option-${idx}`}
                        className="mt-0.5"
                      />
                      <Label
                        htmlFor={`option-${idx}`}
                        className="flex-1 cursor-pointer leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: option }}
                      />
                    </div>
                  ))}
                </RadioGroup>
              )}

              {currentQuestion.type === "true-false" && (
                <RadioGroup
                  value={(answers[currentQuestion._id] as string) || ""}
                  onValueChange={(value) =>
                    handleAnswerChange(currentQuestion._id, value)
                  }
                >
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50">
                    <RadioGroupItem value="true" id="true" />
                    <Label
                      htmlFor="true"
                      className="flex-1 cursor-pointer text-base"
                    >
                      True
                    </Label>
                  </div>
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:border-primary/50">
                    <RadioGroupItem value="false" id="false" />
                    <Label
                      htmlFor="false"
                      className="flex-1 cursor-pointer text-base"
                    >
                      False
                    </Label>
                  </div>
                </RadioGroup>
              )}

              {currentQuestion.type === "short-answer" && (
                <Textarea
                  value={(answers[currentQuestion._id] as string) || ""}
                  onChange={(e) =>
                    handleAnswerChange(currentQuestion._id, e.target.value)
                  }
                  placeholder="Type your answer here..."
                  rows={6}
                  className="text-base"
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Fixed Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg p-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="lg"
            onClick={() =>
              setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))
            }
            disabled={currentQuestionIndex === 0 || !exam?.allowReview}
            className="flex-1"
          >
            <ChevronLeft className="h-5 w-5 mr-1" />
            Previous
          </Button>

          {currentQuestionIndex === questions.length - 1 ? (
            <Button
              size="lg"
              onClick={() => setShowSubmitDialog(true)}
              className="flex-1"
            >
              <Send className="h-5 w-5 mr-2" />
              Submit
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() =>
                setCurrentQuestionIndex(
                  Math.min(questions.length - 1, currentQuestionIndex + 1),
                )
              }
              className="flex-1"
            >
              Next
              <ChevronRight className="h-5 w-5 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* Submit Confirmation Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-status-warning-foreground" />
              Submit Exam?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Are you sure you want to submit your exam?</p>
              <div className="bg-muted p-3 rounded-lg text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Questions:</span>
                  <span className="font-semibold">{questions.length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Answered:</span>
                  <span className="font-semibold text-status-success-foreground">
                    {answeredCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Unanswered:</span>
                  <span className="font-semibold text-status-danger-foreground">
                    {unansweredCount}
                  </span>
                </div>
              </div>
              {unansweredCount > 0 && (
                <p className="text-status-warning-foreground text-sm">
                  ⚠️ You have {unansweredCount} unanswered question
                  {unansweredCount > 1 ? "s" : ""}.
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review Answers</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} className="bg-primary">
              <CheckCircle className="h-4 w-4 mr-2" />
              Submit Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
