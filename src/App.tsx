import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash2, User, SignOut, Github } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: number
  createdBy: string
  authorInfo?: {
    login: string
    avatarUrl: string
  }
}

interface UserInfo {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

interface AuthState {
  isAuthenticated: boolean
  sessionExpiry: number
}

function App() {
  // Personal tasks: Tasks created by the current user, fully editable
  const [personalTasks, setPersonalTasks] = useKV<Task[]>('user-tasks', [])
  // Shared tasks: Tasks created by all users, read-only for non-owners
  const [sharedTasks, setSharedTasks] = useKV<Task[]>('shared-tasks', [])
  const [authState, setAuthState] = useKV<AuthState>('auth-state', { isAuthenticated: false, sessionExpiry: 0 })
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [viewMode, setViewMode] = useState<'personal' | 'shared' | 'all'>('all')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })

  useEffect(() => {
    const initializeAuth = async () => {
      // Check if session has expired
      const now = Date.now()
      if (authState.isAuthenticated && authState.sessionExpiry > now) {
        try {
          const userInfo = await spark.user()
          setUser(userInfo)
        } catch (error) {
          console.error('Failed to load user:', error)
          // Session invalid, reset auth state
          setAuthState({ isAuthenticated: false, sessionExpiry: 0 })
        }
      } else if (authState.isAuthenticated) {
        // Session expired, reset auth state
        setAuthState({ isAuthenticated: false, sessionExpiry: 0 })
        toast.error('Session expired. Please log in again.')
      }
      setIsLoading(false)
    }
    initializeAuth()
  }, [authState.isAuthenticated, authState.sessionExpiry, setAuthState])

  const handleLogin = async () => {
    const { username, password } = loginForm
    
    if (!username.trim() || !password.trim()) {
      toast.error('Please enter both username and password')
      return
    }

    try {
      setIsLoading(true)
      
      // For demo purposes, we'll use GitHub authentication
      // In a real app, you'd validate credentials against your backend
      const userInfo = await spark.user()
      
      // Simulate login validation
      if (username === userInfo.login || username === userInfo.email) {
        const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
        setAuthState({ isAuthenticated: true, sessionExpiry })
        setUser(userInfo)
        setShowLoginDialog(false)
        setLoginForm({ username: '', password: '' })
        toast.success('Login successful!')
      } else {
        toast.error('Invalid credentials. Please use your GitHub username or email.')
      }
    } catch (error) {
      console.error('Login failed:', error)
      toast.error('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogout = () => {
    setAuthState({ isAuthenticated: false, sessionExpiry: 0 })
    setUser(null)
    setPersonalTasks([]) // Clear personal tasks on logout for security
    toast.success('Logged out successfully')
  }

  const handleGitHubLogin = async () => {
    try {
      setIsLoading(true)
      const userInfo = await spark.user()
      const sessionExpiry = Date.now() + (24 * 60 * 60 * 1000) // 24 hours
      setAuthState({ isAuthenticated: true, sessionExpiry })
      setUser(userInfo)
      setShowLoginDialog(false)
      toast.success('GitHub authentication successful!')
    } catch (error) {
      console.error('GitHub auth failed:', error)
      toast.error('GitHub authentication failed')
    } finally {
      setIsLoading(false)
    }
  }

  const addTask = () => {
    if (!authState.isAuthenticated || !user) {
      toast.error('Please log in to add tasks')
      setShowLoginDialog(true)
      return
    }

    const title = newTaskTitle.trim()
    if (!title) {
      toast.error('Please enter a task title')
      return
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      createdAt: Date.now(),
      createdBy: user.login,
      authorInfo: {
        login: user.login,
        avatarUrl: user.avatarUrl
      }
    }

    // Add to personal tasks
    setPersonalTasks((currentTasks) => [newTask, ...currentTasks])
    
    // Add to shared tasks for others to see
    setSharedTasks((currentSharedTasks) => {
      // Check if task from this user already exists to avoid duplicates
      const existingTask = currentSharedTasks.find(task => task.id === newTask.id)
      if (existingTask) return currentSharedTasks
      return [newTask, ...currentSharedTasks]
    })
    
    setNewTaskTitle('')
    toast.success('Task added successfully')
  }

  const toggleTask = (taskId: string) => {
    if (!authState.isAuthenticated || !user) {
      toast.error('Please log in to modify tasks')
      return
    }

    // Only allow toggling personal tasks
    const isPersonalTask = personalTasks.some(task => task.id === taskId && task.createdBy === user.login)
    if (!isPersonalTask) {
      toast.error('You can only modify your own tasks')
      return
    }

    setPersonalTasks((currentTasks) =>
      currentTasks.map(task =>
        task.id === taskId
          ? { ...task, completed: !task.completed }
          : task
      )
    )

    // Update in shared tasks as well
    setSharedTasks((currentSharedTasks) =>
      currentSharedTasks.map(task =>
        task.id === taskId && task.createdBy === user.login
          ? { ...task, completed: !task.completed }
          : task
      )
    )
  }

  const deleteTask = (taskId: string) => {
    if (!authState.isAuthenticated || !user) {
      toast.error('Please log in to delete tasks')
      return
    }

    // Only allow deleting personal tasks
    const isPersonalTask = personalTasks.some(task => task.id === taskId && task.createdBy === user.login)
    if (!isPersonalTask) {
      toast.error('You can only delete your own tasks')
      return
    }

    setPersonalTasks((currentTasks) => currentTasks.filter(task => task.id !== taskId))
    
    // Remove from shared tasks as well
    setSharedTasks((currentSharedTasks) => 
      currentSharedTasks.filter(task => !(task.id === taskId && task.createdBy === user.login))
    )
    
    toast.success('Task deleted')
  }

  // Combine and filter tasks based on view mode
  const allTasks = viewMode === 'personal' 
    ? personalTasks 
    : viewMode === 'shared' 
    ? sharedTasks.filter(task => task.createdBy !== user?.login) 
    : [...personalTasks, ...sharedTasks.filter(task => task.createdBy !== user?.login)]

  const filteredTasks = allTasks.filter(task => {
    if (filter === 'active') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  const activeTasks = allTasks.filter(task => !task.completed)
  const completedTasks = allTasks.filter(task => task.completed)
  const personalActiveTasks = personalTasks.filter(task => !task.completed)
  const personalCompletedTasks = personalTasks.filter(task => task.completed)
  const sharedActiveTasks = sharedTasks.filter(task => task.createdBy !== user?.login && !task.completed)
  const sharedCompletedTasks = sharedTasks.filter(task => task.createdBy !== user?.login && task.completed)

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTask()
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  // Show login prompt if not authenticated
  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">Task Manager</CardTitle>
            <p className="text-muted-foreground">Please log in to access your tasks</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button 
              onClick={() => setShowLoginDialog(true)} 
              className="w-full"
              size="lg"
            >
              <User className="h-4 w-4 mr-2" />
              Log In
            </Button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <Separator className="w-full" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <Button 
              onClick={handleGitHubLogin} 
              variant="outline" 
              className="w-full"
              size="lg"
            >
              <Github className="h-4 w-4 mr-2" />
              Continue with GitHub
            </Button>
          </CardContent>
        </Card>

        {/* Login Dialog */}
        <Dialog open={showLoginDialog} onOpenChange={setShowLoginDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Log In</DialogTitle>
              <DialogDescription>
                Enter your GitHub credentials to access your tasks
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username or Email</Label>
                <Input
                  id="username"
                  placeholder="Enter your GitHub username or email"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleLogin} className="flex-1">
                  Log In
                </Button>
                <Button onClick={() => setShowLoginDialog(false)} variant="outline">
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Header with User Info */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Task Manager</h1>
            <p className="text-muted-foreground">Stay organized and productive</p>
          </div>
          
          {user && (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="font-medium text-foreground">{user.login}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
              <Avatar className="h-10 w-10">
                <AvatarImage src={user.avatarUrl} alt={user.login} />
                <AvatarFallback>
                  <User className="h-5 w-5" />
                </AvatarFallback>
              </Avatar>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleLogout}
                className="text-muted-foreground hover:text-destructive"
              >
                <SignOut className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Add Task Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-lg font-semibold">Add New Task</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <Input
                id="new-task"
                placeholder="What needs to be done?"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyPress={handleKeyPress}
                className="flex-1"
              />
              <Button onClick={addTask} className="shrink-0">
                <Plus className="h-4 w-4 mr-2" />
                Add Task
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* View Mode Tabs */}
        <Tabs value={viewMode} onValueChange={(value) => setViewMode(value as typeof viewMode)} className="mb-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All Tasks
              <Badge variant="secondary" className="ml-1">
                {allTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="personal" className="flex items-center gap-2">
              My Tasks
              <Badge variant="secondary" className="ml-1">
                {personalTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="shared" className="flex items-center gap-2">
              Others' Tasks
              <Badge variant="secondary" className="ml-1">
                {sharedTasks.filter(task => task.createdBy !== user?.login).length}
              </Badge>
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Task Filter Tabs */}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All
              <Badge variant="secondary" className="ml-1">
                {allTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="active" className="flex items-center gap-2">
              Active
              <Badge variant="secondary" className="ml-1">
                {activeTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              Completed
              <Badge variant="secondary" className="ml-1">
                {completedTasks.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} currentUser={user} />
          </TabsContent>
          <TabsContent value="active" className="mt-6">
            <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} currentUser={user} />
          </TabsContent>
          <TabsContent value="completed" className="mt-6">
            <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} currentUser={user} />
          </TabsContent>
        </Tabs>

        {/* Empty State */}
        {filteredTasks.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="text-muted-foreground">
                {filter === 'active' && activeTasks.length === 0 && (
                  <>
                    <p className="text-lg font-medium mb-2">All caught up! 🎉</p>
                    <p>
                      {viewMode === 'shared' 
                        ? "No active tasks from other users. Check back later!"
                        : viewMode === 'personal'
                        ? "You have no active tasks. Time to add some new ones or take a break."
                        : "No active tasks from anyone. Time to add some new ones or take a break."}
                    </p>
                  </>
                )}
                {filter === 'completed' && completedTasks.length === 0 && (
                  <>
                    <p className="text-lg font-medium mb-2">No completed tasks yet</p>
                    <p>
                      {viewMode === 'shared'
                        ? "No one has completed any tasks yet."
                        : viewMode === 'personal'
                        ? "Start checking off some tasks to see them here."
                        : "Start checking off some tasks to see them here."}
                    </p>
                  </>
                )}
                {filter === 'all' && allTasks.length === 0 && (
                  <>
                    <p className="text-lg font-medium mb-2">
                      {viewMode === 'shared' ? "No shared tasks yet" : viewMode === 'personal' ? "No tasks yet" : "No tasks yet"}
                    </p>
                    <p>
                      {viewMode === 'shared'
                        ? "Other users haven't added any tasks yet. Check back later!"
                        : viewMode === 'personal'
                        ? "Add your first task above to get started."
                        : "Add your first task above to get started."}
                    </p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

interface TaskListProps {
  tasks: Task[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  currentUser: UserInfo | null
}

function TaskList({ tasks, onToggle, onDelete, currentUser }: TaskListProps) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => {
          const isOwnTask = currentUser && task.createdBy === currentUser.login
          const canModify = isOwnTask
          
          return (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.2 }}
            >
              <Card className={task.completed ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id={`task-${task.id}`}
                      checked={task.completed}
                      onCheckedChange={() => canModify && onToggle(task.id)}
                      className="shrink-0 mt-0.5"
                      disabled={!canModify}
                    />
                    <div className="flex-1 min-w-0">
                      <label
                        htmlFor={`task-${task.id}`}
                        className={`block text-sm font-medium ${canModify ? 'cursor-pointer' : 'cursor-default'} ${
                          task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                        }`}
                      >
                        {task.title}
                      </label>
                      
                      {/* Author information */}
                      {task.authorInfo && (
                        <div className="flex items-center gap-2 mt-2">
                          <Avatar className="h-5 w-5">
                            <AvatarImage src={task.authorInfo.avatarUrl} alt={task.authorInfo.login} />
                            <AvatarFallback className="text-xs">
                              {task.authorInfo.login[0].toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {isOwnTask ? 'You' : `@${task.authorInfo.login}`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(task.createdAt).toLocaleDateString()}
                          </span>
                          {!isOwnTask && (
                            <Badge variant="outline" className="text-xs">
                              Read-only
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {canModify && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(task.id)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}

export default App