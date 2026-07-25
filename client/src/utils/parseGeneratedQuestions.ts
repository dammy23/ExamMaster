export function parseGeneratedQuestions(responseText: string): any[] {
  const questions: any[] = []

  try {
    // Check if the response contains question-related keywords
    const hasQuestionKeywords = /question|quiz|exam|test|mcq|multiple.?choice|true.?false/i.test(responseText)

    if (!hasQuestionKeywords) {
      return []
    }

    // PRIORITY 1: Look for JSON questions in the response with proper JSON block format
    const jsonMatch = responseText.match(/```json\s*(\{[\s\S]*?\})\s*```/)
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsedData = JSON.parse(jsonMatch[1])
        if (parsedData.questions && Array.isArray(parsedData.questions)) {
          return parsedData.questions.map((q: any, index: number) => ({
            ...q,
            tempId: `json-${Date.now()}-${index}`,
            marks: q.marks || 1,
            difficulty: q.difficulty || 'medium'
          }))
        }
      } catch (jsonError) {
        // Ignore and fall through to the next parsing strategy
      }
    }

    // PRIORITY 2: Look for JSON questions anywhere in the response (fallback)
    const jsonFallbackMatch = responseText.match(/\{[\s\S]*?"questions"[\s\S]*?\}/)
    if (jsonFallbackMatch) {
      try {
        const parsedData = JSON.parse(jsonFallbackMatch[0])
        if (parsedData.questions && Array.isArray(parsedData.questions)) {
          return parsedData.questions.map((q: any, index: number) => ({
            ...q,
            tempId: `json-fallback-${Date.now()}-${index}`,
            marks: q.marks || 1,
            difficulty: q.difficulty || 'medium'
          }))
        }
      } catch (jsonError) {
        // Ignore and fall through to the next parsing strategy
      }
    }

    // PRIORITY 3: Look for structured AI format: **GENERATED QUESTIONS:** followed by **Question 1:** ...
    const structuredSectionMatch = responseText.match(/\*\*GENERATED QUESTIONS:\*\*[\s\S]*/)
    if (structuredSectionMatch) {
      const structuredSection = structuredSectionMatch[0]

      const aiStructuredQuestions = structuredSection.match(/\*\*Question \d+:\*\*[\s\S]*?(?=\*\*Question \d+:\*\*|$)/gi)
      if (aiStructuredQuestions && aiStructuredQuestions.length > 0) {
        aiStructuredQuestions.forEach((questionBlock, index) => {
          const lines = questionBlock.trim().split('\n').map(line => line.trim()).filter(line => line)
          if (lines.length === 0) return

          let question = ''
          let type = 'short-answer'
          let options: string[] = []
          let correctAnswer = ''
          let explanation = ''
          let marks = 1
          let difficulty = 'medium'

          // Extract question text from first line
          const firstLine = lines[0]
          const questionMatch = firstLine.match(/\*\*Question \d+:\*\*\s*(.*)/)
          if (questionMatch) {
            question = questionMatch[1].trim()
          }

          let collectingOptions = false

          // Parse structured fields
          lines.forEach((line) => {
            if (line.startsWith('**Type:**')) {
              type = line.replace('**Type:**', '').trim()
              collectingOptions = false
            } else if (line.startsWith('**Options:**')) {
              collectingOptions = true
            } else if (collectingOptions && line.match(/^[a-d]\)/)) {
              // Option line
              options.push(line.replace(/^[a-d]\)\s*/, ''))
            } else if (line.startsWith('**Correct Answer:**')) {
              correctAnswer = line.replace('**Correct Answer:**', '').trim()
              collectingOptions = false
            } else if (line.startsWith('**Explanation:**')) {
              explanation = line.replace('**Explanation:**', '').trim()
              collectingOptions = false
            } else if (line.startsWith('**Marks:**')) {
              marks = parseInt(line.replace('**Marks:**', '').trim()) || 1
              collectingOptions = false
            } else if (line.startsWith('**Difficulty:**')) {
              difficulty = line.replace('**Difficulty:**', '').trim()
              collectingOptions = false
            }
          })

          if (question) {
            questions.push({
              tempId: `structured-${Date.now()}-${index}`,
              type: type,
              question: question,
              options: options,
              correctAnswers: correctAnswer ? [correctAnswer] : ['Sample answer'],
              explanation: explanation || '',
              marks: marks,
              difficulty: difficulty
            })
          }
        })

        if (questions.length > 0) {
          return questions // Early return to prevent other parsers from running
        }
      }
    }

    // PRIORITY 4: Look for numbered structured format: 1. **Question 1:** ... (fallback for different numbering)
    const aiStructuredQuestions = responseText.match(/\d+\.\s*\*\*Question \d+:\*\*[\s\S]*?(?=\d+\.\s*\*\*Question \d+:\*\*|$)/gi)
    if (aiStructuredQuestions && aiStructuredQuestions.length > 0) {
      aiStructuredQuestions.forEach((questionBlock, index) => {
        const lines = questionBlock.trim().split('\n').map(line => line.trim()).filter(line => line)
        if (lines.length === 0) return

        let question = ''
        let type = 'short-answer'
        let options: string[] = []
        let correctAnswer = ''
        let explanation = ''
        let marks = 1
        let difficulty = 'medium'

        // Extract question text from first line (after the question number)
        const firstLine = lines[0]
        const questionMatch = firstLine.match(/\d+\.\s*\*\*Question \d+:\*\*\s*(.*)/)
        if (questionMatch) {
          question = questionMatch[1].trim()
        }

        let collectingOptions = false

        // Parse structured fields
        lines.forEach((line) => {
          if (line.startsWith('**Type:**')) {
            type = line.replace('**Type:**', '').trim()
            collectingOptions = false
          } else if (line.startsWith('**Options:**')) {
            collectingOptions = true
          } else if (collectingOptions && line.match(/^[a-d]\)/)) {
            // Option line
            options.push(line.replace(/^[a-d]\)\s*/, ''))
          } else if (line.startsWith('**Correct Answer:**')) {
            correctAnswer = line.replace('**Correct Answer:**', '').trim()
            collectingOptions = false
          } else if (line.startsWith('**Explanation:**')) {
            explanation = line.replace('**Explanation:**', '').trim()
            collectingOptions = false
          } else if (line.startsWith('**Marks:**')) {
            marks = parseInt(line.replace('**Marks:**', '').trim()) || 1
            collectingOptions = false
          } else if (line.startsWith('**Difficulty:**')) {
            difficulty = line.replace('**Difficulty:**', '').trim()
            collectingOptions = false
          }
        })

        if (question) {
          questions.push({
            tempId: `numbered-structured-${Date.now()}-${index}`,
            type: type,
            question: question,
            options: options,
            correctAnswers: correctAnswer ? [correctAnswer] : ['Sample answer'],
            explanation: explanation || '',
            marks: marks,
            difficulty: difficulty
          })
        }
      })

      if (questions.length > 0) {
        return questions // Early return to prevent other parsers from running
      }
    }

    // FALLBACK PARSERS: Only run these if no structured questions were found above

    // Look for structured question blocks in markdown format (alternative format)
    const questionBlocks = responseText.match(/\*\*Question \d+[:.]?\*\*([\s\S]*?)(?=\*\*Question \d+[:.]?\*\*|\*\*Answer[:.]?\*\*|$)/gi)
    if (questionBlocks && questionBlocks.length > 0) {
      questionBlocks.forEach((block, index) => {
        const questionMatch = block.match(/\*\*Question \d+[:.]?\*\*(.*?)(?:\*\*(?:Options?|Choices?)[:.]?\*\*|$)/s)
        const optionsMatch = block.match(/\*\*(?:Options?|Choices?)[:.]?\*\*(.*?)(?:\*\*(?:Correct )?Answer[:.]?\*\*|$)/s)
        const answerMatch = block.match(/\*\*(?:Correct )?Answer[:.]?\*\*(.*?)(?:\*\*|$)/s)
        const explanationMatch = block.match(/\*\*Explanation[:.]?\*\*(.*?)(?:\*\*|$)/s)

        if (questionMatch) {
          const question = questionMatch[1].trim()
          const options: string[] = []
          let correctAnswers: string[] = []
          let questionType = 'short-answer'

          // Parse options if present
          if (optionsMatch) {
            const optionLines = optionsMatch[1]
              .split('\n')
              .map(line => line.trim())
              .filter(line => line && (line.match(/^[a-d]\)/) || line.match(/^[a-d]\./) || line.match(/^\d+\./)))

            optionLines.forEach(line => {
              const cleanOption = line.replace(/^[a-d][).]\s*/, '').replace(/^\d+\.\s*/, '').trim()
              if (cleanOption) options.push(cleanOption)
            })

            if (options.length >= 4) {
              questionType = 'multiple-choice'
            }
          }

          // Parse correct answer
          if (answerMatch) {
            const answerText = answerMatch[1].trim()
            if (answerText.toLowerCase() === 'true' || answerText.toLowerCase() === 'false') {
              questionType = 'true-false'
              correctAnswers = [answerText.toLowerCase()]
            } else if (options.length > 0) {
              // Try to match answer to options
              const matchedOption = options.find(opt =>
                opt.toLowerCase().includes(answerText.toLowerCase()) ||
                answerText.toLowerCase().includes(opt.toLowerCase())
              )
              if (matchedOption) {
                correctAnswers = [matchedOption]
              } else {
                correctAnswers = [answerText]
              }
            } else {
              correctAnswers = [answerText]
            }
          }

          const explanation = explanationMatch ? explanationMatch[1].trim() : ''

          questions.push({
            tempId: `markdown-${Date.now()}-${index}`,
            type: questionType,
            question: question,
            options: options,
            correctAnswers: correctAnswers.length > 0 ? correctAnswers : ['Sample answer'],
            explanation: explanation,
            marks: 1,
            difficulty: 'medium'
          })
        }
      })

      if (questions.length > 0) {
        return questions
      }
    }

    // Pattern 1: Simple numbered questions with question marks
    const simpleQuestions = responseText.match(/\d+\.\s*[^?\n]*\?/g)
    if (simpleQuestions && simpleQuestions.length > 0) {
      simpleQuestions.forEach((q, index) => {
        const questionText = q.replace(/^\d+\.\s*/, '').trim()
        if (questionText.length > 15) {
          questions.push({
            tempId: `simple-${Date.now()}-${index}`,
            type: 'short-answer',
            question: questionText,
            options: [],
            correctAnswers: ['Sample answer'],
            explanation: '',
            marks: 1,
            difficulty: 'medium'
          })
        }
      })

      if (questions.length > 0) {
        return questions
      }
    }

    // Pattern 2: Questions that start with "What", "How", "Why", "Where", "When", "Which"
    const wh_questions = responseText.match(/(?:What|How|Why|Where|When|Which|Who)[^?\n]*\?/gi)
    if (wh_questions && wh_questions.length > 0) {
      wh_questions.forEach((q, index) => {
        const questionText = q.trim()
        if (questionText.length > 10 && !questions.some(existing => existing.question === questionText)) {
          questions.push({
            tempId: `wh-${Date.now()}-${index}`,
            type: 'short-answer',
            question: questionText,
            options: [],
            correctAnswers: ['Sample answer'],
            explanation: '',
            marks: 1,
            difficulty: 'medium'
          })
        }
      })

      if (questions.length > 0) {
        return questions
      }
    }

    // Pattern 3: Look for multiple choice blocks
    const mcqMatches = responseText.match(/(?:multiple\s*choice|mcq)[^?]*\?[\s\S]*?[a-d]\)[^\n]+/gi)
    if (mcqMatches && mcqMatches.length > 0) {
      mcqMatches.forEach((block, index) => {
        const questionMatch = block.match(/[^?]*\?/)
        if (questionMatch) {
          const questionText = questionMatch[0].replace(/(?:multiple\s*choice|mcq)\s*/gi, '').trim()
          const optionMatches = block.match(/[a-d]\)[^a-d\n]+/gi)
          const options = optionMatches ? optionMatches.map(opt => opt.replace(/^[a-d]\)\s*/, '')) : []

          if (questionText.length > 10) {
            questions.push({
              tempId: `mcq-${Date.now()}-${index}`,
              type: options.length >= 4 ? 'multiple-choice' : 'short-answer',
              question: questionText,
              options: options,
              correctAnswers: ['Sample answer'],
              explanation: '',
              marks: 1,
              difficulty: 'medium'
            })
          }
        }
      })

      if (questions.length > 0) {
        return questions
      }
    }

    // Pattern 4: True/False questions
    const tfQuestions = responseText.match(/(?:true|false)[^?\n]*\?/gi)
    if (tfQuestions && tfQuestions.length > 0) {
      tfQuestions.forEach((q, index) => {
        const questionText = q.trim()
        if (questionText.length > 10 && !questions.some(existing => existing.question === questionText)) {
          questions.push({
            tempId: `tf-${Date.now()}-${index}`,
            type: 'true-false',
            question: questionText,
            options: [],
            correctAnswers: ['true'],
            explanation: '',
            marks: 1,
            difficulty: 'medium'
          })
        }
      })

      if (questions.length > 0) {
        return questions
      }
    }

    // Final fallbacks if no patterns matched

    // Fallback 1: Any text ending with a question mark that looks substantial
    const allQuestions = responseText.match(/[A-Z][^?\n]{15,}\?/g)
    if (allQuestions && allQuestions.length > 0) {
      allQuestions.forEach((q, index) => {
        const questionText = q.trim()
        if (!questions.some(existing => existing.question === questionText)) {
          questions.push({
            tempId: `fallback-${Date.now()}-${index}`,
            type: 'short-answer',
            question: questionText,
            options: [],
            correctAnswers: ['Sample answer'],
            explanation: '',
            marks: 1,
            difficulty: 'medium'
          })
        }
      })

      if (questions.length > 0) {
        return questions
      }
    }

    // Fallback 2: If response mentions creating/generating questions, create a generic sample
    if (questions.length === 0 && /generat|creat.*question/i.test(responseText)) {
      questions.push({
        tempId: `sample-${Date.now()}`,
        type: 'multiple-choice',
        question: 'Sample question extracted from AI response (please edit)',
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswers: ['Option A'],
        explanation: 'Please update this sample question with actual content from the AI response.',
        marks: 1,
        difficulty: 'medium'
      })
    }

    return questions
  } catch (error) {
    return []
  }
}
