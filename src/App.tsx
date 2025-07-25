import { useState, useEffect } from 'react'
import { useKV } from '@github/spark/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Plus, Trash2, User } from '@phosphor-icons/react'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'

interface Task {
  id: string
  title: string
  completed: boolean
  createdAt: number
}

interface UserInfo {
  avatarUrl: string
  email: string
  id: string
  isOwner: boolean
  login: string
}

function App() {
  const [tasks, setTasks] = useKV<Task[]>('user-tasks', [])
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [user, setUser] = useState<UserInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userInfo = await spark.user()
        setUser(userInfo)
      } catch (error) {
        console.error('Failed to load user:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadUser()
  }, [])

  const addTask = () => {
    const title = newTaskTitle.trim()
    if (!title) {
      toast.error('Please enter a task title')
      return
    }

    const newTask: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      createdAt: Date.now()
    }

    setTasks((currentTasks) => [newTask, ...currentTasks])
    setNewTaskTitle('')
    toast.success('Task added successfully')
  }

  const toggleTask = (taskId: string) => {
    setTasks((currentTasks) =>
      currentTasks.map(task =>
        task.id === taskId
          ? { ...task, completed: !task.completed }
          : task
      )
    )
  }

  const deleteTask = (taskId: string) => {
    setTasks((currentTasks) => currentTasks.filter(task => task.id !== taskId))
    toast.success('Task deleted')
  }

  const filteredTasks = tasks.filter(task => {
    if (filter === 'active') return !task.completed
    if (filter === 'completed') return task.completed
    return true
  })

  const activeTasks = tasks.filter(task => !task.completed)
  const completedTasks = tasks.filter(task => task.completed)

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
          <p className="text-muted-foreground">Loading your tasks...</p>
        </div>
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

        {/* Task Filter Tabs */}
        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)} className="mb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              All
              <Badge variant="secondary" className="ml-1">
                {tasks.length}
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
            <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} />
          </TabsContent>
          <TabsContent value="active" className="mt-6">
            <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} />
          </TabsContent>
          <TabsContent value="completed" className="mt-6">
            <TaskList tasks={filteredTasks} onToggle={toggleTask} onDelete={deleteTask} />
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
                    <p>You have no active tasks. Time to add some new ones or take a break.</p>
                  </>
                )}
                {filter === 'completed' && completedTasks.length === 0 && (
                  <>
                    <p className="text-lg font-medium mb-2">No completed tasks yet</p>
                    <p>Start checking off some tasks to see them here.</p>
                  </>
                )}
                {filter === 'all' && tasks.length === 0 && (
                  <>
                    <p className="text-lg font-medium mb-2">No tasks yet</p>
                    <p>Add your first task above to get started.</p>
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
}

function TaskList({ tasks, onToggle, onDelete }: TaskListProps) {
  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {tasks.map((task) => (
          <motion.div
            key={task.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            transition={{ duration: 0.2 }}
          >
            <Card className={task.completed ? 'opacity-60' : ''}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id={`task-${task.id}`}
                    checked={task.completed}
                    onCheckedChange={() => onToggle(task.id)}
                    className="shrink-0"
                  />
                  <label
                    htmlFor={`task-${task.id}`}
                    className={`flex-1 text-sm font-medium cursor-pointer ${
                      task.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                    }`}
                  >
                    {task.title}
                  </label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDelete(task.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

export default App