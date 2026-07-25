
import { AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title = "Something went wrong", description, onRetry, className }: ErrorStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 py-12 text-center", className)}>
      <AlertTriangle className="h-8 w-8 text-destructive" />
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-2" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
