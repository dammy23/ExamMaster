
export interface BreadcrumbSegment {
  label: string
  href: string
}

const ROUTE_LABELS: Record<string, string> = {
  admin: "Admin",
  student: "Student",
  exams: "Exam Management",
  create: "Create Exam",
  edit: "Edit Exam",
  details: "Details",
  questions: "Questions",
  subjects: "Subjects",
  students: "Students",
  reports: "Reports",
  "ai-chat": "AI Chat",
  settings: "Settings",
  seeding: "Database Seeding",
  results: "My Results",
  instructions: "Instructions",
  mobile: "Mobile",
}

const ID_PATTERN = /^[0-9a-fA-F]{24}$|^\d+$/

export function getBreadcrumbs(pathname: string): BreadcrumbSegment[] {
  const parts = pathname.split("/").filter(Boolean)
  const crumbs: BreadcrumbSegment[] = []
  let href = ""

  for (const part of parts) {
    href += `/${part}`
    const label = ID_PATTERN.test(part) ? "Details" : ROUTE_LABELS[part] ?? part
    crumbs.push({ label, href })
  }

  return crumbs
}
