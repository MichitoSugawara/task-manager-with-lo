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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Plus, Trash2, User, SignOut, Github, CreditCard, Crown, Lock, Users, MessageCircle, Calendar as CalendarIcon, Flag, Project, UserPlus, BarChart3, Settings, Clock, CheckCircle2, AlertCircle, ArrowRight, Reply, ChevronDown } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import { format } from 'date-fns'

interface Task {
  id: string
  title: string
  description?: string
  completed: boolean
  createdAt: number
  createdBy: string
  assignedTo?: string
  teamId?: string
  projectId?: string
  priority: 'low' | 'medium' | 'high'
  dueDate?: number
  authorInfo?: {
    login: string
    avatarUrl: string
  }
  assigneeInfo?: {
    login: string
    avatarUrl: string
  }
  comments?: TaskComment[]
}

interface TaskComment {
  id: string
  content: string
  authorId: string
  authorInfo: {
    login: string
    avatarUrl: string
  }
  createdAt: number
  mentions?: string[]
}

interface Team {
  id: string
  name: string
  description: string
  ownerId: string
  createdAt: number
  members: TeamMember[]
  projects: Project[]
}

interface TeamMember {
  userId: string
  login: string
  avatarUrl: string
  role: 'owner' | 'admin' | 'member'
  joinedAt: number
}

interface Project {
  id: string
  name: string
  description: string
  teamId: string
  createdBy: string
  createdAt: number
  color: string
  status: 'active' | 'completed' | 'archived'
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

interface PaymentState {
  isPremium: boolean
  paymentDate: number | null
  expiryDate: number | null
}

function App() {
  // Personal tasks: Tasks created by the current user, fully editable
  const [personalTasks, setPersonalTasks] = useKV<Task[]>('user-tasks', [])
  // Shared tasks: Tasks created by all users, read-only for non-owners
  const [sharedTasks, setSharedTasks] = useKV<Task[]>('shared-tasks', [])
  // Teams: User's teams and team management
  const [userTeams, setUserTeams] = useKV<Team[]>('user-teams', [])
  const [allTeams, setAllTeams] = useKV<Team[]>('all-teams', [])
  const [authState, setAuthState] = useKV<AuthState>('auth-state', { isAuthenticated: false, sessionExpiry: 0 })
  const [paymentState, setPaymentState] = useKV<PaymentState>('payment-state', { isPremium: false, paymentDate: null, expiryDate: null })
  
  // UI State
  const [currentView, setCurrentView] = useState<'personal' | 'teams' | 'analytics'>('personal')
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const [selectedProject, setSelectedProject] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDescription, setNewTaskDescription] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'low' | 'medium' | 'high'>('medium')
  const [newTaskAssignee, setNewTaskAssignee] = useState<string>('')
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>()
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'assigned-to-me' | 'created-by-me'>('all')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Dialog States
  const [showLoginDialog, setShowLoginDialog] = useState(false)
  const [showPaymentDialog, setShowPaymentDialog] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [showCreateTeamDialog, setShowCreateTeamDialog] = useState(false)
  const [showInviteMemberDialog, setShowInviteMemberDialog] = useState(false)
  const [showCreateProjectDialog, setShowCreateProjectDialog] = useState(false)
  const [showTaskDetailsDialog, setShowTaskDetailsDialog] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  
  // Form States
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [paymentForm, setPaymentForm] = useState({ 
    cardNumber: '', 
    expiryDate: '', 
    cvv: '', 
    name: '',
    email: ''
  })
  const [teamForm, setTeamForm] = useState({ name: '', description: '' })
  const [projectForm, setProjectForm] = useState({ name: '', description: '', color: '#3b82f6' })
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' as 'admin' | 'member' })
  const [newComment, setNewComment] = useState('')

  useEffect(() => {
    const initializeAuth = async () => {
      // Check if session has expired
      const now = Date.now()
      if (authState.isAuthenticated && authState.sessionExpiry > now) {
        try {
          const userInfo = await spark.user()
          setUser(userInfo)
          
          // Check if payment has expired
          if (paymentState.isPremium && paymentState.expiryDate && paymentState.expiryDate < now) {
            setPaymentState({ isPremium: false, paymentDate: null, expiryDate: null })
            toast.error('Premium subscription expired. Please renew to continue adding tasks.')
          }
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
  }, [authState.isAuthenticated, authState.sessionExpiry, paymentState.isPremium, paymentState.expiryDate, setAuthState, setPaymentState])

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

  const handlePayment = async () => {
    const { cardNumber, expiryDate, cvv, name, email } = paymentForm
    
    if (!cardNumber.trim() || !expiryDate.trim() || !cvv.trim() || !name.trim() || !email.trim()) {
      toast.error('Please fill in all payment fields')
      return
    }

    // Basic validation
    if (cardNumber.replace(/\s/g, '').length !== 16) {
      toast.error('Please enter a valid 16-digit card number')
      return
    }

    if (cvv.length !== 3) {
      toast.error('Please enter a valid 3-digit CVV')
      return
    }

    try {
      setIsLoading(true)
      
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000))
      
      // Simulate successful payment
      const now = Date.now()
      const expiryDate = now + (30 * 24 * 60 * 60 * 1000) // 30 days from now
      
      setPaymentState({
        isPremium: true,
        paymentDate: now,
        expiryDate: expiryDate
      })
      
      setShowPaymentDialog(false)
      setShowUpgradeDialog(false)
      setPaymentForm({ cardNumber: '', expiryDate: '', cvv: '', name: '', email: '' })
      toast.success('Payment successful! Welcome to Premium!')
    } catch (error) {
      console.error('Payment failed:', error)
      toast.error('Payment failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
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

  const createTeam = async () => {
    if (!authState.isAuthenticated || !user || !paymentState.isPremium) {
      toast.error('Premium subscription required for team features')
      setShowUpgradeDialog(true)
      return
    }

    const { name, description } = teamForm
    if (!name.trim()) {
      toast.error('Please enter a team name')
      return
    }

    const newTeam: Team = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      ownerId: user.login,
      createdAt: Date.now(),
      members: [{
        userId: user.login,
        login: user.login,
        avatarUrl: user.avatarUrl,
        role: 'owner',
        joinedAt: Date.now()
      }],
      projects: [{
        id: `${Date.now()}-general`,
        name: 'General',
        description: 'Default project for general tasks',
        teamId: Date.now().toString(),
        createdBy: user.login,
        createdAt: Date.now(),
        color: '#6b7280',
        status: 'active'
      }]
    }

    setUserTeams(current => [newTeam, ...current])
    setAllTeams(current => [newTeam, ...current])
    setTeamForm({ name: '', description: '' })
    setShowCreateTeamDialog(false)
    setSelectedTeam(newTeam.id)
    toast.success('Team created successfully!')
  }

  const createProject = async () => {
    if (!selectedTeam || !user) return

    const { name, description, color } = projectForm
    if (!name.trim()) {
      toast.error('Please enter a project name')
      return
    }

    const newProject: Project = {
      id: Date.now().toString(),
      name: name.trim(),
      description: description.trim(),
      teamId: selectedTeam,
      createdBy: user.login,
      createdAt: Date.now(),
      color,
      status: 'active'
    }

    setUserTeams(current => 
      current.map(team => 
        team.id === selectedTeam 
          ? { ...team, projects: [newProject, ...team.projects] }
          : team
      )
    )
    setAllTeams(current => 
      current.map(team => 
        team.id === selectedTeam 
          ? { ...team, projects: [newProject, ...team.projects] }
          : team
      )
    )
    
    setProjectForm({ name: '', description: '', color: '#3b82f6' })
    setShowCreateProjectDialog(false)
    setSelectedProject(newProject.id)
    toast.success('Project created successfully!')
  }

  const addComment = async (taskId: string) => {
    if (!user || !newComment.trim()) return

    const comment: TaskComment = {
      id: Date.now().toString(),
      content: newComment.trim(),
      authorId: user.login,
      authorInfo: {
        login: user.login,
        avatarUrl: user.avatarUrl
      },
      createdAt: Date.now(),
      mentions: extractMentions(newComment)
    }

    // Update task with new comment
    setPersonalTasks(current =>
      current.map(task =>
        task.id === taskId
          ? { ...task, comments: [...(task.comments || []), comment] }
          : task
      )
    )

    setSharedTasks(current =>
      current.map(task =>
        task.id === taskId
          ? { ...task, comments: [...(task.comments || []), comment] }
          : task
      )
    )

    setNewComment('')
    toast.success('Comment added!')
  }

  const extractMentions = (text: string): string[] => {
    const mentionRegex = /@([a-zA-Z0-9_-]+)/g
    const mentions: string[] = []
    let match
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1])
    }
    return mentions
  }

  const addTask = () => {
    if (!authState.isAuthenticated || !user) {
      toast.error('Please log in to add tasks')
      setShowLoginDialog(true)
      return
    }

    // Check premium status
    if (!paymentState.isPremium) {
      toast.error('Premium subscription required to add tasks')
      setShowUpgradeDialog(true)
      return
    }

    // Check if premium has expired
    const now = Date.now()
    if (paymentState.expiryDate && paymentState.expiryDate < now) {
      setPaymentState({ isPremium: false, paymentDate: null, expiryDate: null })
      toast.error('Premium subscription expired. Please renew to add tasks.')
      setShowUpgradeDialog(true)
      return
    }

    const title = newTaskTitle.trim()
    if (!title) {
      toast.error('Please enter a task title')
      return
    }

    // Get assignee info if task is assigned
    let assigneeInfo: { login: string; avatarUrl: string } | undefined
    if (newTaskAssignee && selectedTeam) {
      const team = userTeams.find(t => t.id === selectedTeam)
      const assignee = team?.members.find(m => m.login === newTaskAssignee)
      if (assignee) {
        assigneeInfo = {
          login: assignee.login,
          avatarUrl: assignee.avatarUrl
        }
      }
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      description: newTaskDescription.trim() || undefined,
      completed: false,
      createdAt: Date.now(),
      createdBy: user.login,
      assignedTo: newTaskAssignee || undefined,
      teamId: selectedTeam || undefined,
      projectId: selectedProject || undefined,
      priority: newTaskPriority,
      dueDate: newTaskDueDate?.getTime(),
      authorInfo: {
        login: user.login,
        avatarUrl: user.avatarUrl
      },
      assigneeInfo,
      comments: []
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
    
    // Reset form
    setNewTaskTitle('')
    setNewTaskDescription('')
    setNewTaskPriority('medium')
    setNewTaskAssignee('')
    setNewTaskDueDate(undefined)
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

  // Get current team and project info
  const currentTeam = selectedTeam ? userTeams.find(t => t.id === selectedTeam) : null
  const currentProject = selectedProject ? currentTeam?.projects.find(p => p.id === selectedProject) : null

  // Filter tasks based on current view and selection
  const getFilteredTasks = () => {
    let baseTasks: Task[] = []
    
    if (currentView === 'personal') {
      baseTasks = personalTasks
    } else if (currentView === 'teams' && selectedTeam) {
      // Show tasks from selected team
      baseTasks = [...personalTasks, ...sharedTasks].filter(task => 
        task.teamId === selectedTeam && 
        (selectedProject ? task.projectId === selectedProject : true)
      )
    } else {
      baseTasks = [...personalTasks, ...sharedTasks.filter(task => task.createdBy !== user?.login)]
    }

    // Apply additional filters
    return baseTasks.filter(task => {
      if (filter === 'active') return !task.completed
      if (filter === 'completed') return task.completed
      if (filter === 'assigned-to-me') return task.assignedTo === user?.login
      if (filter === 'created-by-me') return task.createdBy === user?.login
      return true
    })
  }

  const filteredTasks = getFilteredTasks()
  const activeTasks = filteredTasks.filter(task => !task.completed)
  const completedTasks = filteredTasks.filter(task => task.completed)

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addTask()
    }
  }

  const openTaskDetails = (task: Task) => {
    setSelectedTask(task)
    setShowTaskDetailsDialog(true)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500 bg-red-50 border-red-200'
      case 'medium': return 'text-yellow-500 bg-yellow-50 border-yellow-200'
      case 'low': return 'text-green-500 bg-green-50 border-green-200'
      default: return 'text-gray-500 bg-gray-50 border-gray-200'
    }
  }

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <AlertCircle className="h-3 w-3" />
      case 'medium': return <Flag className="h-3 w-3" />
      case 'low': return <CheckCircle2 className="h-3 w-3" />
      default: return <Flag className="h-3 w-3" />
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
            <CardTitle className="text-2xl font-bold">Premium Task Manager</CardTitle>
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
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header with User Info */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">Premium Task Manager</h1>
            <p className="text-muted-foreground">
              {currentView === 'teams' && currentTeam ? `Team: ${currentTeam.name}` : 'Stay organized and productive'}
              {currentProject && ` • Project: ${currentProject.name}`}
            </p>
          </div>
          
          {user && (
            <div className="flex items-center gap-3">
              {/* Premium Status Badge */}
              {paymentState.isPremium ? (
                <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                  <Crown className="h-4 w-4" />
                  Premium
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowUpgradeDialog(true)}
                  className="bg-gradient-to-r from-primary to-accent text-primary-foreground border-0 hover:opacity-90"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Upgrade to Premium
                </Button>
              )}
              
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

        {/* Main Navigation */}
        <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as typeof currentView)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="personal" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Tasks
            </TabsTrigger>
            <TabsTrigger value="teams" className="flex items-center gap-2" disabled={!paymentState.isPremium}>
              <Users className="h-4 w-4" />
              Team Collaboration
              {!paymentState.isPremium && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2" disabled={!paymentState.isPremium}>
              <BarChart3 className="h-4 w-4" />
              Analytics
              {!paymentState.isPremium && <Lock className="h-3 w-3 ml-1" />}
            </TabsTrigger>
          </TabsList>

          {/* Personal Tasks Tab */}
          <TabsContent value="personal" className="space-y-6">
            <PersonalTasksView 
              tasks={personalTasks}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              newTaskDescription={newTaskDescription}
              setNewTaskDescription={setNewTaskDescription}
              newTaskPriority={newTaskPriority}
              setNewTaskPriority={setNewTaskPriority}
              newTaskDueDate={newTaskDueDate}
              setNewTaskDueDate={setNewTaskDueDate}
              filter={filter}
              setFilter={setFilter}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onOpenTaskDetails={openTaskDetails}
              handleKeyPress={handleKeyPress}
              isPremium={paymentState.isPremium}
              currentUser={user}
              getPriorityColor={getPriorityColor}
              getPriorityIcon={getPriorityIcon}
            />
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams" className="space-y-6">
            <TeamsView 
              userTeams={userTeams}
              selectedTeam={selectedTeam}
              setSelectedTeam={setSelectedTeam}
              selectedProject={selectedProject}
              setSelectedProject={setSelectedProject}
              currentTeam={currentTeam}
              currentProject={currentProject}
              filteredTasks={filteredTasks}
              newTaskTitle={newTaskTitle}
              setNewTaskTitle={setNewTaskTitle}
              newTaskDescription={newTaskDescription}
              setNewTaskDescription={setNewTaskDescription}
              newTaskPriority={newTaskPriority}
              setNewTaskPriority={setNewTaskPriority}
              newTaskAssignee={newTaskAssignee}
              setNewTaskAssignee={setNewTaskAssignee}
              newTaskDueDate={newTaskDueDate}
              setNewTaskDueDate={setNewTaskDueDate}
              filter={filter}
              setFilter={setFilter}
              onAddTask={addTask}
              onToggleTask={toggleTask}
              onDeleteTask={deleteTask}
              onOpenTaskDetails={openTaskDetails}
              onCreateTeam={() => setShowCreateTeamDialog(true)}
              onCreateProject={() => setShowCreateProjectDialog(true)}
              onInviteMember={() => setShowInviteMemberDialog(true)}
              handleKeyPress={handleKeyPress}
              currentUser={user}
              getPriorityColor={getPriorityColor}
              getPriorityIcon={getPriorityIcon}
            />
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <AnalyticsView 
              personalTasks={personalTasks}
              userTeams={userTeams}
              currentUser={user}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* Upgrade to Premium Dialog */}
      <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Upgrade to Premium
            </DialogTitle>
            <DialogDescription>
              Unlock team collaboration and advanced features
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Unlimited task creation</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Team collaboration tools</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Project organization</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Task assignment & comments</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm">Team analytics dashboard</span>
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 p-4 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-foreground">$9.99</div>
                <div className="text-sm text-muted-foreground">per month</div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button 
                onClick={() => {
                  setShowUpgradeDialog(false)
                  setShowPaymentDialog(true)
                }} 
                className="flex-1 bg-gradient-to-r from-primary to-accent"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Subscribe Now
              </Button>
              <Button onClick={() => setShowUpgradeDialog(false)} variant="outline">
                Maybe Later
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Team Dialog */}
      <Dialog open={showCreateTeamDialog} onOpenChange={setShowCreateTeamDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Team</DialogTitle>
            <DialogDescription>
              Start collaborating with your team members
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team-name">Team Name</Label>
              <Input
                id="team-name"
                placeholder="Enter team name"
                value={teamForm.name}
                onChange={(e) => setTeamForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Description (Optional)</Label>
              <Textarea
                id="team-description"
                placeholder="Describe your team's purpose"
                value={teamForm.description}
                onChange={(e) => setTeamForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={createTeam} className="flex-1">
                <Users className="h-4 w-4 mr-2" />
                Create Team
              </Button>
              <Button onClick={() => setShowCreateTeamDialog(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog open={showCreateProjectDialog} onOpenChange={setShowCreateProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Organize tasks into projects for better management
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="Enter project name"
                value={projectForm.name}
                onChange={(e) => setProjectForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                placeholder="Describe this project"
                value={projectForm.description}
                onChange={(e) => setProjectForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-color">Color</Label>
              <Select value={projectForm.color} onValueChange={(value) => setProjectForm(prev => ({ ...prev, color: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a color" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="#3b82f6">Blue</SelectItem>
                  <SelectItem value="#10b981">Green</SelectItem>
                  <SelectItem value="#f59e0b">Yellow</SelectItem>
                  <SelectItem value="#ef4444">Red</SelectItem>
                  <SelectItem value="#8b5cf6">Purple</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={createProject} className="flex-1">
                <Project className="h-4 w-4 mr-2" />
                Create Project
              </Button>
              <Button onClick={() => setShowCreateProjectDialog(false)} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Premium Subscription Payment</DialogTitle>
            <DialogDescription>
              Complete your payment to activate Premium features
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="card-number">Card Number</Label>
              <Input
                id="card-number"
                placeholder="1234 5678 9012 3456"
                value={paymentForm.cardNumber}
                onChange={(e) => {
                  // Format card number with spaces
                  let value = e.target.value.replace(/\s/g, '').replace(/\D/g, '')
                  value = value.replace(/(\d{4})(?=\d)/g, '$1 ')
                  if (value.length <= 19) {
                    setPaymentForm(prev => ({ ...prev, cardNumber: value }))
                  }
                }}
                maxLength={19}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={paymentForm.expiryDate}
                  onChange={(e) => {
                    let value = e.target.value.replace(/\D/g, '')
                    if (value.length >= 2) {
                      value = value.substring(0, 2) + '/' + value.substring(2, 4)
                    }
                    if (value.length <= 5) {
                      setPaymentForm(prev => ({ ...prev, expiryDate: value }))
                    }
                  }}
                  maxLength={5}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  value={paymentForm.cvv}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '')
                    if (value.length <= 3) {
                      setPaymentForm(prev => ({ ...prev, cvv: value }))
                    }
                  }}
                  maxLength={3}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="cardholder-name">Cardholder Name</Label>
              <Input
                id="cardholder-name"
                placeholder="John Doe"
                value={paymentForm.name}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="john@example.com"
                value={paymentForm.email}
                onChange={(e) => setPaymentForm(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button 
                onClick={handlePayment} 
                className="flex-1 bg-gradient-to-r from-primary to-accent"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <CreditCard className="h-4 w-4 mr-2" />
                )}
                {isLoading ? 'Processing...' : 'Pay $9.99'}
              </Button>
              <Button 
                onClick={() => setShowPaymentDialog(false)} 
                variant="outline"
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              This is a demo payment form. No real charges will be made.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Task Details Dialog */}
      <Dialog open={showTaskDetailsDialog} onOpenChange={setShowTaskDetailsDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selectedTask.title}
                  {selectedTask.priority && (
                    <Badge className={`${getPriorityColor(selectedTask.priority)} text-xs`}>
                      {getPriorityIcon(selectedTask.priority)}
                      <span className="ml-1">{selectedTask.priority}</span>
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription>
                  Task details and collaboration
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Task Info */}
                <div className="space-y-3">
                  {selectedTask.description && (
                    <div>
                      <Label className="text-sm font-medium">Description</Label>
                      <p className="text-sm text-muted-foreground mt-1">{selectedTask.description}</p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Created by</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={selectedTask.authorInfo?.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {selectedTask.authorInfo?.login[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{selectedTask.authorInfo?.login}</span>
                      </div>
                    </div>
                    
                    {selectedTask.assignedTo && (
                      <div>
                        <Label className="text-sm font-medium">Assigned to</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={selectedTask.assigneeInfo?.avatarUrl} />
                            <AvatarFallback className="text-xs">
                              {selectedTask.assigneeInfo?.login[0]?.toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">{selectedTask.assigneeInfo?.login}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {selectedTask.dueDate && (
                    <div>
                      <Label className="text-sm font-medium">Due Date</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{format(new Date(selectedTask.dueDate), 'PPP')}</span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Comments Section */}
                <div className="space-y-4">
                  <Label className="text-sm font-medium">Comments ({selectedTask.comments?.length || 0})</Label>
                  
                  {/* Add Comment */}
                  <div className="flex gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user?.avatarUrl} />
                      <AvatarFallback className="text-xs">
                        {user?.login[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2">
                      <Textarea
                        placeholder="Add a comment... (use @username to mention)"
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        className="min-h-[80px]"
                      />
                      <Button 
                        onClick={() => addComment(selectedTask.id)} 
                        size="sm"
                        disabled={!newComment.trim()}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Comment
                      </Button>
                    </div>
                  </div>

                  {/* Comments List */}
                  <div className="space-y-4">
                    {selectedTask.comments?.map((comment) => (
                      <div key={comment.id} className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={comment.authorInfo.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {comment.authorInfo.login[0]?.toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">{comment.authorInfo.login}</span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(comment.createdAt), 'PPp')}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">{comment.content}</p>
                        </div>
                      </div>
                    ))}
                    
                    {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No comments yet. Be the first to comment!
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

interface TaskListProps {
  tasks: Task[]
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  currentUser: UserInfo | null
}

function TaskList({ tasks, onToggle, onDelete, currentUser, onOpenDetails, getPriorityColor, getPriorityIcon, showTeamInfo }: any) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {tasks.map((task: Task) => {
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
                      <div className="flex items-center gap-2 mb-1">
                        <label
                          htmlFor={`task-${task.id}`}
                          className={`text-sm font-medium ${canModify ? 'cursor-pointer' : 'cursor-default'} ${
                            task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </label>
                        {task.priority && (
                          <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                            {getPriorityIcon(task.priority)}
                            <span className="ml-1">{task.priority}</span>
                          </Badge>
                        )}
                        {task.dueDate && (
                          <Badge variant="outline" className="text-xs">
                            <CalendarIcon className="h-3 w-3 mr-1" />
                            {format(new Date(task.dueDate), 'MMM dd')}
                          </Badge>
                        )}
                      </div>
                      
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-2">{task.description}</p>
                      )}
                      
                      {/* Task Info */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        {task.authorInfo && (
                          <div className="flex items-center gap-1">
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={task.authorInfo.avatarUrl} alt={task.authorInfo.login} />
                              <AvatarFallback className="text-xs">
                                {task.authorInfo.login[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>{isOwnTask ? 'You' : `@${task.authorInfo.login}`}</span>
                          </div>
                        )}
                        {task.assignedTo && task.assigneeInfo && (
                          <div className="flex items-center gap-1">
                            <ArrowRight className="h-3 w-3" />
                            <Avatar className="h-4 w-4">
                              <AvatarImage src={task.assigneeInfo.avatarUrl} />
                              <AvatarFallback className="text-xs">
                                {task.assigneeInfo.login[0].toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span>@{task.assigneeInfo.login}</span>
                          </div>
                        )}
                        <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                        {task.comments && task.comments.length > 0 && (
                          <div className="flex items-center gap-1">
                            <MessageCircle className="h-3 w-3" />
                            <span>{task.comments.length}</span>
                          </div>
                        )}
                        {!isOwnTask && (
                          <Badge variant="outline" className="text-xs">
                            Read-only
                          </Badge>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {onOpenDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onOpenDetails(task)}
                          className="shrink-0 text-muted-foreground hover:text-foreground"
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      )}
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
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </AnimatePresence>
      
      {tasks.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">No tasks yet</p>
              <p>Add some tasks to get started with your productivity journey!</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Personal Tasks View Component
function PersonalTasksView({ 
  tasks, 
  newTaskTitle, 
  setNewTaskTitle, 
  newTaskDescription, 
  setNewTaskDescription, 
  newTaskPriority, 
  setNewTaskPriority, 
  newTaskDueDate, 
  setNewTaskDueDate, 
  filter, 
  setFilter, 
  onAddTask, 
  onToggleTask, 
  onDeleteTask, 
  onOpenTaskDetails, 
  handleKeyPress, 
  isPremium, 
  currentUser, 
  getPriorityColor, 
  getPriorityIcon 
}: any) {
  const filteredTasks = tasks.filter((task: Task) => {
    if (filter === 'active') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  return (
    <div className="space-y-6">
      {/* Add Task Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            Add New Task
            {!isPremium && <Lock className="h-4 w-4 text-muted-foreground" />}
          </CardTitle>
          {!isPremium && (
            <p className="text-sm text-muted-foreground">
              Premium subscription required to add tasks.
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Input
              placeholder={isPremium ? "What needs to be done?" : "Premium required to add tasks"}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyPress={handleKeyPress}
              className="flex-1"
              disabled={!isPremium}
            />
            <Button onClick={onAddTask} disabled={!isPremium}>
              <Plus className="h-4 w-4 mr-2" />
              Add Task
            </Button>
          </div>
          
          {isPremium && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Task description..."
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low Priority</SelectItem>
                      <SelectItem value="medium">Medium Priority</SelectItem>
                      <SelectItem value="high">High Priority</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTaskDueDate ? format(newTaskDueDate, "PPP") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={newTaskDueDate}
                        onSelect={setNewTaskDueDate}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Filter */}
      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All ({tasks.length})</TabsTrigger>
          <TabsTrigger value="active">Active ({tasks.filter((t: Task) => !t.completed).length})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({tasks.filter((t: Task) => t.completed).length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value={filter} className="mt-4">
          <TaskList 
            tasks={filteredTasks} 
            onToggle={onToggleTask} 
            onDelete={onDeleteTask} 
            onOpenDetails={onOpenTaskDetails}
            currentUser={currentUser}
            getPriorityColor={getPriorityColor}
            getPriorityIcon={getPriorityIcon}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Teams View Component
function TeamsView({ 
  userTeams, 
  selectedTeam, 
  setSelectedTeam, 
  selectedProject, 
  setSelectedProject, 
  currentTeam, 
  currentProject, 
  filteredTasks, 
  newTaskTitle, 
  setNewTaskTitle, 
  newTaskDescription, 
  setNewTaskDescription, 
  newTaskPriority, 
  setNewTaskPriority, 
  newTaskAssignee, 
  setNewTaskAssignee, 
  newTaskDueDate, 
  setNewTaskDueDate, 
  filter, 
  setFilter, 
  onAddTask, 
  onToggleTask, 
  onDeleteTask, 
  onOpenTaskDetails, 
  onCreateTeam, 
  onCreateProject, 
  onInviteMember, 
  handleKeyPress, 
  currentUser, 
  getPriorityColor, 
  getPriorityIcon 
}: any) {
  return (
    <div className="space-y-6">
      {/* Team Selection */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Collaboration
            </CardTitle>
            <Button onClick={onCreateTeam} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Create Team
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {userTeams.length === 0 ? (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">No teams yet</p>
              <p className="text-muted-foreground mb-4">Create your first team to start collaborating</p>
              <Button onClick={onCreateTeam}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Select value={selectedTeam || ''} onValueChange={setSelectedTeam}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a team" />
                </SelectTrigger>
                <SelectContent>
                  {userTeams.map((team: Team) => (
                    <SelectItem key={team.id} value={team.id}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {currentTeam && (
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <h3 className="font-medium">{currentTeam.name}</h3>
                    <p className="text-sm text-muted-foreground">{currentTeam.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">{currentTeam.members.length} members</p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onCreateProject}>
                      <Project className="h-4 w-4 mr-2" />
                      New Project
                    </Button>
                    <Button variant="outline" size="sm" onClick={onInviteMember}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Invite
                    </Button>
                  </div>
                </div>
              )}

              {currentTeam && currentTeam.projects.length > 0 && (
                <div className="space-y-2">
                  <Label>Project</Label>
                  <Select value={selectedProject || ''} onValueChange={setSelectedProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {currentTeam.projects.map((project: Project) => (
                        <SelectItem key={project.id} value={project.id}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: project.color }}
                            ></div>
                            {project.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Task Management */}
      {selectedTeam && (
        <>
          {/* Add Team Task */}
          <Card>
            <CardHeader>
              <CardTitle>Add Team Task</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="What needs to be done for the team?"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyPress={handleKeyPress}
                  className="flex-1"
                />
                <Button onClick={onAddTask}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Task
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Assign to</Label>
                    <Select value={newTaskAssignee} onValueChange={setNewTaskAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Assign to team member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {currentTeam?.members.map((member: TeamMember) => (
                          <SelectItem key={member.userId} value={member.login}>
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={member.avatarUrl} />
                                <AvatarFallback className="text-xs">
                                  {member.login[0].toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              {member.login}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low Priority</SelectItem>
                        <SelectItem value="medium">Medium Priority</SelectItem>
                        <SelectItem value="high">High Priority</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {newTaskDueDate ? format(newTaskDueDate, "PPP") : "Pick a date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <Calendar
                          mode="single"
                          selected={newTaskDueDate}
                          onSelect={setNewTaskDueDate}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Task description..."
                      value={newTaskDescription}
                      onChange={(e) => setNewTaskDescription(e.target.value)}
                      className="min-h-[60px]"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Task Filter for Teams */}
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
              <TabsTrigger value="assigned-to-me">Assigned to Me</TabsTrigger>
              <TabsTrigger value="created-by-me">Created by Me</TabsTrigger>
            </TabsList>
            
            <TabsContent value={filter} className="mt-4">
              <TaskList 
                tasks={filteredTasks} 
                onToggle={onToggleTask} 
                onDelete={onDeleteTask} 
                onOpenDetails={onOpenTaskDetails}
                currentUser={currentUser}
                getPriorityColor={getPriorityColor}
                getPriorityIcon={getPriorityIcon}
                showTeamInfo={true}
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

// Analytics View Component  
function AnalyticsView({ personalTasks, userTeams, currentUser }: any) {
  const totalTasks = personalTasks.length
  const completedTasks = personalTasks.filter((task: Task) => task.completed).length
  const activeTasks = totalTasks - completedTasks
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  const priorityStats = {
    high: personalTasks.filter((task: Task) => task.priority === 'high').length,
    medium: personalTasks.filter((task: Task) => task.priority === 'medium').length,
    low: personalTasks.filter((task: Task) => task.priority === 'low').length
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Tasks</p>
                <p className="text-2xl font-bold">{totalTasks}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active Tasks</p>
                <p className="text-2xl font-bold">{activeTasks}</p>
              </div>
              <Clock className="h-8 w-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedTasks}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completion Rate</p>
                <p className="text-2xl font-bold">{completionRate}%</p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Priority Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500" />
                  <span className="text-sm">High Priority</span>
                </div>
                <span className="font-medium">{priorityStats.high}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">Medium Priority</span>
                </div>
                <span className="font-medium">{priorityStats.medium}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm">Low Priority</span>
                </div>
                <span className="font-medium">{priorityStats.low}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Team Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Teams Joined</span>
                <span className="font-medium">{userTeams.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Teams Owned</span>
                <span className="font-medium">
                  {userTeams.filter((team: Team) => team.ownerId === currentUser?.login).length}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Projects</span>
                <span className="font-medium">
                  {userTeams.reduce((acc: number, team: Team) => acc + team.projects.length, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default App