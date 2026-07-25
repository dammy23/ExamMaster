# Graph Report - .  (2026-07-25)

## Corpus Check
- 178 files · ~109,666 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1249 nodes · 2510 edges · 68 communities (63 shown, 5 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 52 edges (avg confidence: 0.67)
- Token cost: 94,238 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Client API Exams & Questions|Client API: Exams & Questions]]
- [[_COMMUNITY_Client API Exam Attempts|Client API: Exam Attempts]]
- [[_COMMUNITY_Client API AI Platform Config|Client API: AI Platform Config]]
- [[_COMMUNITY_Client Dependencies|Client Dependencies]]
- [[_COMMUNITY_Server DB Config & Settings|Server DB Config & Settings]]
- [[_COMMUNITY_Server Dependencies|Server Dependencies]]
- [[_COMMUNITY_Sidebar UI Components|Sidebar UI Components]]
- [[_COMMUNITY_Client API AI Chat|Client API: AI Chat]]
- [[_COMMUNITY_CICD & Project Docs|CI/CD & Project Docs]]
- [[_COMMUNITY_PDF Report Generation|PDF Report Generation]]
- [[_COMMUNITY_Auth Routes & Seeding|Auth Routes & Seeding]]
- [[_COMMUNITY_Client Dev Tooling|Client Dev Tooling]]
- [[_COMMUNITY_Client Auth & Layout|Client Auth & Layout]]
- [[_COMMUNITY_Root Package PDFChart Deps|Root Package: PDF/Chart Deps]]
- [[_COMMUNITY_TS Config (App)|TS Config (App)]]
- [[_COMMUNITY_Video Proctoring|Video Proctoring]]
- [[_COMMUNITY_Report Routes|Report Routes]]
- [[_COMMUNITY_Component Aliases Config|Component Aliases Config]]
- [[_COMMUNITY_TS Config (Node)|TS Config (Node)]]
- [[_COMMUNITY_Misc UI Primitives|Misc UI Primitives]]
- [[_COMMUNITY_Document Parsing (AI Question Gen)|Document Parsing (AI Question Gen)]]
- [[_COMMUNITY_PaginationResizable UI|Pagination/Resizable UI]]
- [[_COMMUNITY_AI Chat Routes|AI Chat Routes]]
- [[_COMMUNITY_AI Chat Service|AI Chat Service]]
- [[_COMMUNITY_AI Platform Routes & Auth Middleware|AI Platform Routes & Auth Middleware]]
- [[_COMMUNITY_Carousel UI|Carousel UI]]
- [[_COMMUNITY_Exam Attempt Service|Exam Attempt Service]]
- [[_COMMUNITY_Toast & Theme Provider|Toast & Theme Provider]]
- [[_COMMUNITY_Form UI Components|Form UI Components]]
- [[_COMMUNITY_Menubar UI|Menubar UI]]
- [[_COMMUNITY_Toast UI|Toast UI]]
- [[_COMMUNITY_Question Model & Service|Question Model & Service]]
- [[_COMMUNITY_Database Admin Routes|Database Admin Routes]]
- [[_COMMUNITY_Chart UI|Chart UI]]
- [[_COMMUNITY_AI Config Models & Seeding|AI Config Models & Seeding]]
- [[_COMMUNITY_AI Platform Model & Seeding|AI Platform Model & Seeding]]
- [[_COMMUNITY_Exam Model & Seed Data|Exam Model & Seed Data]]
- [[_COMMUNITY_Exam Attempt Model & Test Seeding|Exam Attempt Model & Test Seeding]]
- [[_COMMUNITY_Student Group & User Models|Student Group & User Models]]
- [[_COMMUNITY_Subject Model & Service|Subject Model & Service]]
- [[_COMMUNITY_LLM Service (AnthropicOpenAI)|LLM Service (Anthropic/OpenAI)]]
- [[_COMMUNITY_Command Palette UI|Command Palette UI]]
- [[_COMMUNITY_Context Menu UI|Context Menu UI]]
- [[_COMMUNITY_Question Routes & CSV Upload|Question Routes & CSV Upload]]
- [[_COMMUNITY_User Routes & CSV Upload|User Routes & CSV Upload]]
- [[_COMMUNITY_Exam Service|Exam Service]]
- [[_COMMUNITY_Sheet UI|Sheet UI]]
- [[_COMMUNITY_AI Chat Model|AI Chat Model]]
- [[_COMMUNITY_Exam Routes|Exam Routes]]
- [[_COMMUNITY_AI Grading Service|AI Grading Service]]
- [[_COMMUNITY_Breadcrumb UI|Breadcrumb UI]]
- [[_COMMUNITY_Drawer UI|Drawer UI]]
- [[_COMMUNITY_Navigation Menu UI|Navigation Menu UI]]
- [[_COMMUNITY_Exam Attempt Service Dependencies|Exam Attempt Service Dependencies]]
- [[_COMMUNITY_Sidebar Nav & Scroll Area|Sidebar Nav & Scroll Area]]
- [[_COMMUNITY_Toggle UI|Toggle UI]]
- [[_COMMUNITY_TS Config (Root)|TS Config (Root)]]
- [[_COMMUNITY_Student Group Service|Student Group Service]]
- [[_COMMUNITY_Subject Service|Subject Service]]
- [[_COMMUNITY_PDF Service Dependencies|PDF Service Dependencies]]
- [[_COMMUNITY_Rich Text Editor|Rich Text Editor]]
- [[_COMMUNITY_Setting Routes|Setting Routes]]

## God Nodes (most connected - your core abstractions)
1. `cn()` - 72 edges
2. `useToast()` - 66 edges
3. `Button` - 33 edges
4. `Card` - 26 edges
5. `CardContent` - 26 edges
6. `CardHeader` - 24 edges
7. `CardTitle` - 24 edges
8. `Badge()` - 23 edges
9. `CardDescription` - 23 edges
10. `compilerOptions` - 20 edges

## Surprising Connections (you probably didn't know these)
- `Student CSV Bulk Upload Format` --semantically_similar_to--> `Question CSV Bulk Upload Format`  [INFERRED] [semantically similar]
  CSV_UPLOAD_FORMAT.md → CSV_UPLOAD_FORMAT_QUESTIONS.md
- `Pythagora Utils Script (external S3-hosted asset)` --conceptually_related_to--> `ExamMaster Platform`  [AMBIGUOUS]
  client/index.html → README.md
- `Examination Engine` --conceptually_related_to--> `Question CSV Bulk Upload Format`  [INFERRED]
  README.md → CSV_UPLOAD_FORMAT_QUESTIONS.md
- `generateQuestions()` --references--> `FormData`  [EXTRACTED]
  client/src/api/aiChat.ts → test_upload.js
- `uploadVideoRecording()` --references--> `FormData`  [EXTRACTED]
  client/src/api/examAttempts.ts → test_upload.js

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Question Types Supported by CSV Bulk Upload** — csv_upload_format_questions_multiple_choice, csv_upload_format_questions_true_false, csv_upload_format_questions_short_answer [EXTRACTED 1.00]
- **Docker Build and Deploy Pipeline Flow** — _github_workflows_docker_build_build_job, _github_workflows_docker_build_deploy_job, _github_workflows_docker_build_exam_master_image, _github_workflows_docker_build_ssh_deploy_step [EXTRACTED 1.00]
- **ExamMaster Technology Stack** — readme_reactjs, readme_vite, readme_expressjs, readme_mongodb [EXTRACTED 1.00]

## Communities (68 total, 5 thin omitted)

### Community 0 - "Client API: Exams & Questions"
Cohesion: 0.06
Nodes (100): Exam, bulkUploadQuestions(), createQuestion(), deleteQuestion(), getQuestionById(), getQuestions(), Question, updateQuestion() (+92 more)

### Community 1 - "Client API: Exam Attempts"
Cohesion: 0.06
Nodes (74): register(), ExamAttempt, ExamQuestion, getAdminRecentActivity(), getStudentExamAttempts(), getStudentRecentResults(), logExamActivity(), saveExamAnswer() (+66 more)

### Community 2 - "Client API: AI Platform Config"
Cohesion: 0.06
Nodes (44): getAIPlatforms(), initializeAIPlatforms(), setDefaultAIPlatform(), testAIPlatform(), updateAIPlatform(), api, getApiInstance(), isRefreshTokenEndpoint() (+36 more)

### Community 3 - "Client Dependencies"
Cohesion: 0.04
Nodes (55): dependencies, axios, class-variance-authority, clsx, cmdk, date-fns, embla-carousel-react, @heroicons/react (+47 more)

### Community 4 - "Server DB Config & Settings"
Cohesion: 0.05
Nodes (28): connectDB(), mongoose, mongoose, Setting, settingSchema, express, router, { connectDB } (+20 more)

### Community 5 - "Server Dependencies"
Cohesion: 0.04
Nodes (46): author, dependencies, @anthropic-ai/sdk, axios, bcrypt, body-parser, chart.js, chartjs-node-canvas (+38 more)

### Community 6 - "Sidebar UI Components"
Cohesion: 0.06
Nodes (36): getAttemptForReview(), getExamAttemptsForReview(), Separator, Sidebar, SidebarContent, SidebarContext, SidebarFooter, SidebarGroup (+28 more)

### Community 7 - "Client API: AI Chat"
Cohesion: 0.08
Nodes (24): createQuestionsWithAI(), generateQuestions(), getAIAgents(), getChatHistory(), sendChatMessage(), uploadChatFile(), getActiveAIPlatforms(), assignQuestionsToExam() (+16 more)

### Community 8 - "CI/CD & Project Docs"
Cohesion: 0.08
Nodes (31): build Job, deploy Job, Docker Hub Login Step (docker/login-action), exam-master Docker Image, SSH into Server and Deploy Step (appleboy/ssh-action), Build and Push Docker Image Workflow, index.html (App Shell), Pythagora Utils Script (external S3-hosted asset) (+23 more)

### Community 9 - "PDF Report Generation"
Cohesion: 0.10
Nodes (7): ReportsPDF(), ReportsPDFProps, styles, PDFService, path, React, ReactPdfService

### Community 10 - "Auth Routes & Seeding"
Cohesion: 0.07
Nodes (15): express, { generateAccessToken, generateRefreshToken }, jwt, { requireUser }, router, UserService, SeedService, UserService (+7 more)

### Community 11 - "Client Dev Tooling"
Cohesion: 0.07
Nodes (26): devDependencies, autoprefixer, eslint, @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh, globals, postcss (+18 more)

### Community 12 - "Client Auth & Layout"
Cohesion: 0.12
Nodes (17): login(), logout(), getCurrentUser(), Footer(), Header(), Layout(), ProtectedRoute(), RoleDashboard() (+9 more)

### Community 13 - "Root Package: PDF/Chart Deps"
Cohesion: 0.07
Nodes (26): author, dependencies, canvas, chart.js, chartjs-node-canvas, concurrently, html-pdf-node, jspdf (+18 more)

### Community 14 - "TS Config (App)"
Cohesion: 0.09
Nodes (22): compilerOptions, allowImportingTsExtensions, baseUrl, isolatedModules, jsx, lib, module, moduleDetection (+14 more)

### Community 15 - "Video Proctoring"
Cohesion: 0.13
Nodes (15): AIGradingService, ExamAttemptService, express, path, { requireUser }, router, { videoUpload, generateSecureVideoUrl, validateVideoAccessToken, getVideoFileInfo }, crypto (+7 more)

### Community 16 - "Report Routes"
Cohesion: 0.13
Nodes (17): Exam, ExamAttempt, express, jwt, mongoose, pdfService, reactPdfService, requireDownloadAuth() (+9 more)

### Community 17 - "Component Aliases Config"
Cohesion: 0.11
Nodes (17): aliases, components, hooks, lib, ui, utils, iconLibrary, rsc (+9 more)

### Community 18 - "TS Config (Node)"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+9 more)

### Community 19 - "Misc UI Primitives"
Cohesion: 0.12
Nodes (11): input-otp, AccordionContent, AccordionItem, AccordionTrigger, HoverCardContent, InputOTP, InputOTPGroup, InputOTPSeparator (+3 more)

### Community 20 - "Document Parsing (AI Question Gen)"
Cohesion: 0.18
Nodes (4): DocumentParsingService, mammoth, path, pdf

### Community 21 - "Pagination/Resizable UI"
Cohesion: 0.19
Nodes (13): ButtonProps, Pagination(), PaginationContent, PaginationEllipsis(), PaginationItem, PaginationLink(), PaginationLinkProps, PaginationNext() (+5 more)

### Community 22 - "AI Chat Routes"
Cohesion: 0.12
Nodes (12): AIChatService, DocumentParsingService, ExamService, express, multer, path, QuestionService, { requireUser } (+4 more)

### Community 24 - "AI Platform Routes & Auth Middleware"
Cohesion: 0.17
Nodes (12): AIPlatform, express, { requireUser, requireAdmin }, router, jwt, requireAdmin(), requireUser(), User (+4 more)

### Community 25 - "Carousel UI"
Cohesion: 0.14
Nodes (12): Carousel, CarouselApi, CarouselContent, CarouselContext, CarouselContextProps, CarouselItem, CarouselNext, CarouselOptions (+4 more)

### Community 27 - "Toast & Theme Provider"
Cohesion: 0.17
Nodes (10): sonner, Toaster(), ToasterProps, initialState, Theme, ThemeProvider(), ThemeProviderContext, ThemeProviderProps (+2 more)

### Community 28 - "Form UI Components"
Cohesion: 0.17
Nodes (9): FormControl, FormDescription, FormFieldContext, FormFieldContextValue, FormItem, FormItemContext, FormItemContextValue, FormLabel (+1 more)

### Community 29 - "Menubar UI"
Cohesion: 0.17
Nodes (11): Menubar, MenubarCheckboxItem, MenubarContent, MenubarItem, MenubarLabel, MenubarRadioItem, MenubarSeparator, MenubarShortcut() (+3 more)

### Community 30 - "Toast UI"
Cohesion: 0.24
Nodes (10): Toast, ToastAction, ToastActionElement, ToastClose, ToastDescription, ToastProps, ToastRoot, ToastTitle (+2 more)

### Community 31 - "Question Model & Service"
Cohesion: 0.17
Nodes (4): mongoose, questionSchema, Question, QuestionService

### Community 32 - "Database Admin Routes"
Cohesion: 0.18
Nodes (7): DatabaseService, express, router, { seedAIData }, DatabaseService, mongoose, User

### Community 33 - "Chart UI"
Cohesion: 0.18
Nodes (7): ChartConfig, ChartContainer, ChartContext, ChartContextProps, ChartLegendContent, ChartTooltipContent, THEMES

### Community 34 - "AI Config Models & Seeding"
Cohesion: 0.27
Nodes (9): AIAgent, aiAgentSchema, AIModel, aiModelSchema, mongoose, { AIModel, AIAgent }, seedAIAgents(), seedAIData() (+1 more)

### Community 35 - "AI Platform Model & Seeding"
Cohesion: 0.18
Nodes (8): AIPlatform, aiPlatformSchema, mongoose, { AIAgent }, AIPlatform, express, router, SeedService

### Community 36 - "Exam Model & Seed Data"
Cohesion: 0.18
Nodes (8): Exam, examSchema, mongoose, Exam, mongoose, path, Subject, User

### Community 37 - "Exam Attempt Model & Test Seeding"
Cohesion: 0.18
Nodes (8): ExamAttempt, examAttemptSchema, mongoose, Exam, ExamAttempt, mongoose, path, User

### Community 38 - "Student Group & User Models"
Cohesion: 0.18
Nodes (8): mongoose, StudentGroup, studentGroupSchema, mongoose, User, userSchema, StudentGroup, User

### Community 39 - "Subject Model & Service"
Cohesion: 0.18
Nodes (8): mongoose, Subject, subjectSchema, express, { requireUser }, router, SubjectService, Subject

### Community 40 - "LLM Service (Anthropic/OpenAI)"
Cohesion: 0.29
Nodes (10): Anthropic, axios, dotenv, getAnthropicClient(), getOpenAIClient(), OpenAI, sendLLMRequest(), sendRequestToAnthropic() (+2 more)

### Community 41 - "Command Palette UI"
Cohesion: 0.20
Nodes (8): Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator, CommandShortcut()

### Community 42 - "Context Menu UI"
Cohesion: 0.20
Nodes (9): ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuRadioItem, ContextMenuSeparator, ContextMenuShortcut(), ContextMenuSubContent (+1 more)

### Community 43 - "Question Routes & CSV Upload"
Cohesion: 0.20
Nodes (9): csv, express, fs, multer, questionService, { requireUser }, router, storage (+1 more)

### Community 44 - "User Routes & CSV Upload"
Cohesion: 0.20
Nodes (9): csv, express, fs, multer, { requireUser }, router, storage, upload (+1 more)

### Community 46 - "Sheet UI"
Cohesion: 0.22
Nodes (8): SheetContent, SheetContentProps, SheetDescription, SheetFooter(), SheetHeader(), SheetOverlay, SheetTitle, sheetVariants

### Community 47 - "AI Chat Model"
Cohesion: 0.22
Nodes (7): AIChat, aiChatSchema, mongoose, { AIAgent }, AIChat, AIPlatform, llmService

### Community 48 - "Exam Routes"
Cohesion: 0.22
Nodes (7): ExamService, express, { requireUser }, router, Exam, mongoose, Question

### Community 49 - "AI Grading Service"
Cohesion: 0.31
Nodes (3): AIGradingService, AIPlatform, llmService

### Community 50 - "Breadcrumb UI"
Cohesion: 0.25
Nodes (7): Breadcrumb, BreadcrumbEllipsis(), BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator()

### Community 51 - "Drawer UI"
Cohesion: 0.25
Nodes (6): DrawerContent, DrawerDescription, DrawerFooter(), DrawerHeader(), DrawerOverlay, DrawerTitle

### Community 52 - "Navigation Menu UI"
Cohesion: 0.25
Nodes (7): NavigationMenu, NavigationMenuContent, NavigationMenuIndicator, NavigationMenuList, NavigationMenuTrigger, navigationMenuTriggerStyle, NavigationMenuViewport

### Community 53 - "Exam Attempt Service Dependencies"
Cohesion: 0.25
Nodes (7): AIGradingService, emailService, Exam, ExamAttempt, mongoose, Question, User

### Community 54 - "Sidebar Nav & Scroll Area"
Cohesion: 0.33
Nodes (4): adminNavItems, studentNavItems, ScrollArea, ScrollBar

### Community 55 - "Toggle UI"
Cohesion: 0.33
Nodes (5): ToggleGroup, ToggleGroupContext, ToggleGroupItem, Toggle, toggleVariants

### Community 56 - "TS Config (Root)"
Cohesion: 0.29
Nodes (6): compilerOptions, baseUrl, paths, files, @/*, references

### Community 59 - "PDF Service Dependencies"
Cohesion: 0.33
Nodes (5): { ChartJSNodeCanvas }, htmlPdf, { jsPDF }, path, puppeteer

### Community 60 - "Rich Text Editor"
Cohesion: 0.50
Nodes (3): BlockEmbed, RichTextEditorProps, VideoBlot

### Community 61 - "Setting Routes"
Cohesion: 0.40
Nodes (4): express, { requireUser }, router, SettingService

## Ambiguous Edges - Review These
- `ExamMaster Platform` → `Pythagora Utils Script (external S3-hosted asset)`  [AMBIGUOUS]
  client/index.html · relation: conceptually_related_to

## Knowledge Gaps
- **596 isolated node(s):** `$schema`, `style`, `rsc`, `tsx`, `config` (+591 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What is the exact relationship between `ExamMaster Platform` and `Pythagora Utils Script (external S3-hosted asset)`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **Why does `PDFService` connect `PDF Report Generation` to `PDF Service Dependencies`?**
  _High betweenness centrality (0.329) - this node is a cross-community bridge._
- **Why does `cn()` connect `Pagination/Resizable UI` to `Client API: Exams & Questions`, `Client API: Exam Attempts`, `Sidebar UI Components`, `Client Auth & Layout`, `Misc UI Primitives`, `Carousel UI`, `Form UI Components`, `Menubar UI`, `Toast UI`, `Chart UI`, `Command Palette UI`, `Context Menu UI`, `Sheet UI`, `Breadcrumb UI`, `Drawer UI`, `Navigation Menu UI`, `Sidebar Nav & Scroll Area`, `Toggle UI`, `Rich Text Editor`?**
  _High betweenness centrality (0.149) - this node is a cross-community bridge._
- **Why does `requireUser()` connect `AI Platform Routes & Auth Middleware` to `Subject Model & Service`, `Auth Routes & Seeding`, `Question Routes & CSV Upload`, `User Routes & CSV Upload`, `Video Proctoring`, `Exam Routes`, `Report Routes`, `AI Chat Routes`, `Setting Routes`?**
  _High betweenness centrality (0.110) - this node is a cross-community bridge._
- **What connects `$schema`, `style`, `rsc` to the rest of the system?**
  _597 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Client API: Exams & Questions` be split into smaller, more focused modules?**
  _Cohesion score 0.060192531471490535 - nodes in this community are weakly interconnected._
- **Should `Client API: Exam Attempts` be split into smaller, more focused modules?**
  _Cohesion score 0.05531914893617021 - nodes in this community are weakly interconnected._