# Task Management App with Login

A personal task management application that leverages user authentication to provide a personalized todo experience with data persistence.

**Experience Qualities**:
1. **Efficient** - Quick task creation and management without friction
2. **Personal** - Tailored experience that feels owned by the user
3. **Reliable** - Tasks persist between sessions and feel secure

**Complexity Level**: Light Application (multiple features with basic state)
- Multiple interconnected features (login, task CRUD, filtering) with persistent state management and user-specific data handling.

## Essential Features

### User Authentication Display
- **Functionality**: Shows user's GitHub profile information and login status
- **Purpose**: Personalizes the experience and confirms user identity
- **Trigger**: Automatic on app load
- **Progression**: App loads → Fetch user info → Display avatar and name → Enable task features
- **Success criteria**: User sees their GitHub avatar, name, and login status clearly

### Task Creation
- **Functionality**: Add new tasks with title and optional description
- **Purpose**: Capture todos quickly without friction
- **Trigger**: Click "Add Task" button or press Enter in input field
- **Progression**: Click add → Enter task details → Save → Task appears in list → Input clears
- **Success criteria**: New tasks appear immediately and persist after page refresh

### Task Management
- **Functionality**: Mark tasks complete/incomplete, edit task text, delete tasks
- **Purpose**: Maintain accurate task status and allow corrections
- **Trigger**: Click checkbox, edit button, or delete button on task items
- **Progression**: Click action → Immediate visual feedback → State updated → Changes persist
- **Success criteria**: All changes save instantly and survive page refresh

### Task Filtering
- **Functionality**: View all tasks, only active tasks, or only completed tasks
- **Purpose**: Focus on relevant tasks and reduce visual clutter
- **Trigger**: Click filter tabs (All, Active, Completed)
- **Progression**: Click filter → List updates → Active filter highlighted → Task count updates
- **Success criteria**: Filtering works instantly and shows accurate counts

### Data Persistence
- **Functionality**: All tasks and user preferences saved per user account
- **Purpose**: Ensure work isn't lost and experience feels personal
- **Trigger**: Any task or setting change
- **Progression**: User action → Data saved to user's key-value store → Confirmation feedback
- **Success criteria**: Data persists across browser sessions and is user-specific

## Edge Case Handling
- **Empty task creation**: Prevent saving tasks with empty titles, show validation message
- **Offline state**: Show graceful message if user data can't be loaded
- **Long task titles**: Truncate or wrap text appropriately in task list
- **Rapid clicking**: Debounce actions to prevent duplicate operations
- **User logout/login**: Handle authentication state changes gracefully

## Design Direction
The interface should feel clean, modern, and productivity-focused with subtle personal touches from the user's GitHub profile - minimal design that prioritizes task content over interface chrome.

## Color Selection
Analogous (adjacent colors on color wheel) - Using a cool blue-to-purple progression that feels calm and professional while remaining energizing for productivity.

- **Primary Color**: Deep blue (oklch(0.45 0.15 250)) - Communicates trust and focus
- **Secondary Colors**: Light blue-gray (oklch(0.85 0.05 250)) for backgrounds and muted elements
- **Accent Color**: Vibrant purple (oklch(0.55 0.2 280)) - For completion states and positive actions
- **Foreground/Background Pairings**: 
  - Background (Light Gray oklch(0.98 0.01 250)): Dark Blue text (oklch(0.25 0.1 250)) - Ratio 8.2:1 ✓
  - Card (White oklch(1 0 0)): Dark Blue text (oklch(0.25 0.1 250)) - Ratio 9.1:1 ✓
  - Primary (Deep Blue oklch(0.45 0.15 250)): White text (oklch(1 0 0)) - Ratio 4.8:1 ✓
  - Accent (Purple oklch(0.55 0.2 280)): White text (oklch(1 0 0)) - Ratio 4.6:1 ✓

## Font Selection
Typography should convey efficiency and clarity with excellent readability for scanning task lists quickly - using Inter for its optimized screen rendering and neutral personality.

- **Typographic Hierarchy**: 
  - H1 (App Title): Inter Bold/24px/tight letter spacing
  - H2 (Section Headers): Inter Semibold/18px/normal spacing  
  - Body (Task Text): Inter Regular/16px/relaxed line height
  - Small (Counts/Meta): Inter Medium/14px/normal spacing

## Animations
Subtle functionality-focused animations that provide immediate feedback without being distracting - quick state changes that feel responsive and confirm user actions.

- **Purposeful Meaning**: Motion reinforces the satisfying nature of completing tasks and guides attention to state changes
- **Hierarchy of Movement**: Task completion gets the most animation focus, followed by adding/removing tasks, with filtering being most subtle

## Component Selection
- **Components**: Card for task container, Button for actions, Input for task creation, Checkbox for completion, Badge for counts, Avatar for user profile, Tabs for filtering
- **Customizations**: Custom task item component combining Card + Checkbox + Button actions
- **States**: Buttons show hover/active states, tasks have distinct completed/pending visual states, inputs show focus clearly
- **Icon Selection**: Plus for add, Check for complete, X for delete, User for profile, Filter for view options
- **Spacing**: Consistent 16px padding for cards, 8px gaps between tasks, 24px margins for sections
- **Mobile**: Single column layout, larger touch targets (48px minimum), collapsible sections for better mobile navigation