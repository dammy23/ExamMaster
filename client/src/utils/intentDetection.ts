export type DetectedIntent = 'create-subject' | 'create-exam' | null

interface IntentPattern {
  keywords: string[]
  intent: DetectedIntent
}

// Define patterns for different intents
const intentPatterns: IntentPattern[] = [
  {
    keywords: ['create subject', 'new subject', 'add subject', 'make subject', 'create a subject', 'create new subject'],
    intent: 'create-subject'
  },
  {
    keywords: ['create exam', 'new exam', 'add exam', 'make exam', 'create a exam', 'create new exam', 'create an exam'],
    intent: 'create-exam'
  }
]

/**
 * Detects user intentions from chat messages for creating subjects or exams
 * @param message - The user's message text
 * @returns The detected intent or null if no intent is detected
 */
export function detectIntention(message: string): DetectedIntent {
  if (!message || typeof message !== 'string') {
    return null
  }

  // Normalize the message - convert to lowercase and trim
  const normalizedMessage = message.toLowerCase().trim()

  // Check each pattern
  for (const pattern of intentPatterns) {
    for (const keyword of pattern.keywords) {
      if (normalizedMessage.includes(keyword)) {
        return pattern.intent
      }
    }
  }

  // Additional fuzzy matching for common variations
  const subjectVariations = [
    /create.*subject/i,
    /new.*subject/i,
    /add.*subject/i,
    /make.*subject/i,
    /subject.*create/i,
    /subject.*new/i,
    /subject.*add/i,
    /subject.*make/i
  ]

  const examVariations = [
    /create.*exam/i,
    /new.*exam/i,
    /add.*exam/i,
    /make.*exam/i,
    /exam.*create/i,
    /exam.*new/i,
    /exam.*add/i,
    /exam.*make/i
  ]

  // Check subject variations
  for (const pattern of subjectVariations) {
    if (pattern.test(message)) {
      return 'create-subject'
    }
  }

  // Check exam variations
  for (const pattern of examVariations) {
    if (pattern.test(message)) {
      return 'create-exam'
    }
  }

  return null
}

/**
 * Gets a user-friendly description of the detected intent
 * @param intent - The detected intent
 * @returns A human-readable description
 */
export function getIntentDescription(intent: DetectedIntent): string {
  switch (intent) {
    case 'create-subject':
      return 'create a new subject'
    case 'create-exam':
      return 'create a new exam'
    default:
      return 'perform an action'
  }
}