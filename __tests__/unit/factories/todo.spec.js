import { createUser } from "../../../factories/user"
import { createTodo } from "../../../factories/todo"

describe('todo factory', () => {
  const user = createUser({id: 1, email: "test@email.com"})
  test('create todo', () => {
    const todo = createTodo(user, "test")
    
    expect(todo).toHaveProperty('user_id', 1)
    expect(todo).toHaveProperty('task_name', 'test')
    expect(todo).toHaveProperty('task_status', 1)
    
  })

  test('set todo task', () => {
    const todo = createTodo(user, "test")
    todo.setTaskName("new task")
    expect(todo.task_name).toEqual('new task')
  })

  test('set todo status', () => {
    const todo = createTodo(user, "test")
    todo.setStatus(99)
    expect(todo.task_status).toEqual(99)
  })
})