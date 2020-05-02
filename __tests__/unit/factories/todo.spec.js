import { createUser } from "../../../factories/user"
import { createTodo } from "../../../factories/todo"

describe('todo factory', () => {
  const user = createUser({id: 1, email: "test@email.com"})
  test('create todo', () => {
    createTodo(user, "test")
  })
})