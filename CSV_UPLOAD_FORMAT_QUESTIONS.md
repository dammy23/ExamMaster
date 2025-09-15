# CSV Bulk Upload Format for Questions

## Overview

The ExamMaster application supports bulk upload of questions using CSV files. This document describes the required format and validation rules.

## Required CSV Format

### Column Structure

Your CSV file must contain the following columns in order:

1. **type** - Question type (required)
2. **question** - Question text (required)
3. **difficulty** - Question difficulty (required)
4. **marks** - Points awarded for correct answer (required)
5. **option1** - First option (required for multiple-choice)
6. **option2** - Second option (required for multiple-choice)
7. **option3** - Third option (required for multiple-choice)
8. **option4** - Fourth option (required for multiple-choice)
9. **option5** - Fifth option (optional for multiple-choice)
10. **option6** - Sixth option (optional for multiple-choice)
11. **correctAnswer** - Correct answer specification (required)
12. **explanation** - Explanation or hint (optional)

### Question Types

#### 1. Multiple Choice Questions (`multiple-choice`)

- **Options**: Must provide at least 4 options (option1-option4), up to 6 options maximum
- **Correct Answer**: Use option numbers (1-6) to specify correct answers
  - Single correct answer: `1` (refers to option1)
  - Multiple correct answers: `1,3,5` (refers to option1, option3, and option5)
- **Validation**: Option numbers must be between 1-6 and correspond to existing options

**Example:**
```csv
multiple-choice,"What is the capital of France?",easy,1,"Paris","London","Berlin","Madrid","","","1","Paris is the capital of France."
multiple-choice,"Which are programming languages?",medium,2,"Python","Java","HTML","CSS","JavaScript","TypeScript","1,2,5,6","Programming languages vs markup languages."
```

#### 2. True/False Questions (`true-false`)

- **Options**: Leave option columns empty (they will be auto-populated with True/False)
- **Correct Answer**: Use `true` or `false` (case-insensitive)

**Example:**
```csv
true-false,"The Earth is round",easy,1,"","","","","","","true","Basic geography fact."
```

#### 3. Short Answer Questions (`short-answer`)

- **Options**: Leave option columns empty
- **Correct Answer**: Provide sample correct answers (can be multiple, comma-separated)

**Example:**
```csv
short-answer,"What does CPU stand for?",medium,2,"","","","","","","Central Processing Unit","CPU acronym definition."
```

### Field Specifications

#### Required Fields
- **type**: Must be one of: `multiple-choice`, `true-false`, `short-answer`
- **question**: Question text (10-1000 characters)
- **difficulty**: Must be one of: `easy`, `medium`, `hard`
- **marks**: Positive integer (1-100)
- **correctAnswer**: Answer specification (format depends on question type)

#### Optional Fields
- **option5**, **option6**: Additional options for multiple-choice questions
- **explanation**: Additional explanation or hint (max 500 characters)

## Validation Rules

### Multiple Choice Questions
1. Must have at least 4 options and at most 6 options
2. correctAnswer must use option numbers (1-6) only
3. Option numbers must correspond to existing options
4. Must have at least one correct answer
5. Invalid option numbers will be logged and ignored

### True/False Questions  
1. correctAnswer must be "true" or "false"
2. Options are automatically set to ["True", "False"]

### Short Answer Questions
1. correctAnswer should contain sample answers
2. Multiple sample answers can be separated by commas

## Error Handling

The system will:
- Skip questions with missing required fields
- Log warnings for invalid option numbers
- Filter out invalid correct answers automatically
- Provide detailed error messages in server logs
- Return summary of imported vs. skipped questions

## Legacy Format Support

The system maintains backward compatibility with the old format where correctAnswer contained actual text values instead of option numbers. The system automatically detects the format:

- **New format**: `1,2,5` (option numbers)
- **Legacy format**: `Python,Java,JavaScript` (actual text)

## Example CSV File

```csv
type,question,difficulty,marks,option1,option2,option3,option4,option5,option6,correctAnswer,explanation
multiple-choice,"What is 2 + 2?",easy,1,"1","2","3","4","5","6","4","Basic arithmetic operation"
multiple-choice,"Which are programming languages?",medium,2,"Python","Java","HTML","CSS","JavaScript","TypeScript","1,2,5,6","Programming languages vs markup/styling"
true-false,"The Earth is round",easy,1,"","","","","","","true","Basic geography fact"
short-answer,"Name the capital of France",easy,2,"","","","","","","Paris","Basic geography knowledge"
```

## Usage Notes

1. Column names are case-insensitive
2. Extra spaces in values are automatically trimmed
3. Empty options (option5, option6) should be left as empty strings
4. Maximum file size: 10MB
5. Only CSV files are accepted
6. Questions with validation errors will be skipped but won't stop the entire upload