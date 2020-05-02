import uuid from 'uuid'

const impl = {
  createTodo: (user, taskName) => {
    return {
      id: uuid.v1(),
      user_id: user.id,
      task_name: taskName,
      task_status: 1,
      setTaskName: (taskName) => {
        this.task_name = taskName
        return this
      },
      setStatus: (status) => {
        this.task_status = status
        return this
      }
    }
  }
}

export const { createTodo } = impl