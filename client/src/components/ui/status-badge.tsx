
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

export type Status =
  | "active"
  | "in-progress"
  | "published"
  | "draft"
  | "archived"
  | "completed"
  | "graded"
  | "pending-review"
  | "flagged"
  | "overdue"
  | "rejected"
  | "error"

const STATUS_LABELS: Record<Status, string> = {
  active: "Active",
  "in-progress": "In Progress",
  published: "Published",
  draft: "Draft",
  archived: "Archived",
  completed: "Completed",
  graded: "Graded",
  "pending-review": "Pending Review",
  flagged: "Flagged",
  overdue: "Overdue",
  rejected: "Rejected",
  error: "Error",
}

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      status: {
        active: "bg-accent text-accent-foreground",
        "in-progress": "bg-accent text-accent-foreground",
        published: "bg-accent text-accent-foreground",
        draft: "bg-muted text-muted-foreground",
        archived: "bg-muted text-muted-foreground opacity-60",
        completed: "bg-status-info text-status-info-foreground",
        graded: "bg-status-info text-status-info-foreground",
        "pending-review": "bg-status-warning text-status-warning-foreground",
        flagged: "bg-status-warning text-status-warning-foreground",
        overdue: "bg-status-danger text-status-danger-foreground",
        rejected: "bg-status-danger text-status-danger-foreground",
        error: "bg-status-danger text-status-danger-foreground",
      } satisfies Record<Status, string>,
    },
    defaultVariants: {
      status: "draft",
    },
  }
)

export interface StatusBadgeProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof statusBadgeVariants> {
  status: Status
}

export function StatusBadge({ status, className, ...props }: StatusBadgeProps) {
  return (
    <div className={cn(statusBadgeVariants({ status }), className)} {...props}>
      {STATUS_LABELS[status]}
    </div>
  )
}
