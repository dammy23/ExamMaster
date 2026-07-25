import type { Exam } from "@/api/exams"

export interface ExamStatusAction {
  label: string
  nextStatus: Exam['status']
}

const STATUS_ACTIONS: Record<Exam['status'], ExamStatusAction[]> = {
  draft: [
    { label: 'Publish', nextStatus: 'active' },
    { label: 'Archive', nextStatus: 'archived' }
  ],
  active: [
    { label: 'Mark Completed', nextStatus: 'completed' },
    { label: 'Archive', nextStatus: 'archived' }
  ],
  completed: [
    { label: 'Archive', nextStatus: 'archived' }
  ],
  archived: [
    { label: 'Restore to Draft', nextStatus: 'draft' }
  ]
}

export function getAvailableStatusActions(current: Exam['status']): ExamStatusAction[] {
  return STATUS_ACTIONS[current] || []
}
