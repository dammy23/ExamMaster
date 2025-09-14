# CSV Bulk Upload Format for Students

## Required Format

When using the bulk upload feature for students, your CSV file should contain the following columns:

### Required Columns
- `name` or `fullname` - Student's full name
- `email` or `emailaddress` - Student's email address
- `password` or `defaultpassword` - Default password for the student

### Optional Columns
- `role` - User role (defaults to 'student')
- `studentId` or `id` - Student ID number
- `applicationNo` or `appno` - Application number
- `group` or `class` - Student group/class name
- `enrollmentDate` or `joindate` - Enrollment date
- `status` - Account status (active/inactive, defaults to 'active')

## Example CSV Content

```csv
name,email,password,studentId,applicationNo,group,status
John Doe,john.doe@example.com,password123,STU001,APP001,Computer Science A,active
Jane Smith,jane.smith@example.com,password123,STU002,APP002,Mathematics B,active
Bob Johnson,bob.johnson@example.com,password123,STU003,APP003,Computer Science A,active
```

## Notes

1. Column names are case-insensitive and spaces are ignored
2. If `studentId` or `applicationNo` are not provided, they will be auto-generated
3. If a student with the same email already exists, that row will be skipped
4. The system will provide a summary of imported students and any errors encountered
5. Maximum file size: 5MB
6. Only CSV files are accepted