import client from "./client";
import { createDbParam } from "../factories/dbParam";
import { createTodo } from "../factories/todo";

const TABLE_NAME = process.env.TODO_TABLE

const impl = {
  storeTodo: async (user, taskName) => {
    const task = createTodo(user, taskName)
    const payload = {
      TableName: process.env.TODO_TABLE,
      Item: task,
    };
    return client.put(payload).promise()
      .then(res => {
        return task
      });
  },
  indexTodos: async (user, status) => {
    let filterExprs = 'user_id = :userId'
    const exprAttrValues = {
      ':userId': user.id
    }
    if (status) {
      filterExprs += ' AND task_status = :s'
      Object.assign(exprAttrValues, {
        ':s': parseInt(status)
      })
    }
    const param = createDbParam(TABLE_NAME, filterExprs, exprAttrValues)
    console.log('db scan params', param)
    return client.scan(param).promise()
    .then(result => result.Items)
  }
}

export const { storeTodo, indexTodos } = impl

