import client from "./client";
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
    const param = {
      TableName: TABLE_NAME,
      FilterExpression: filterExprs,
      ExpressionAttributeValues: exprAttrValues
    }
    console.log('db scan params', param)
    return client.scan(param).promise()
    .then(result => result.Items)
  },
  updateTodo: async (id, user, {status}) => {
    const payload = {
      TableName: process.env.TODO_TABLE,
      Key: {
        'id': id
      },
      UpdateExpression: 'SET task_status = :t',
      ConditionExpression: 'user_id = :userId',
      ExpressionAttributeValues: {
        ':t' : parseInt(status),
        ':userId': user.id
      },
      ReturnValues: "ALL_NEW"
    }
    return client.update(payload).promise()
      .then((res) => {
        console.log('update dynamo', res)
        return res.Attributes
      })
  },
  clearCompletedTodos: async (user) => {
    impl.indexTodos(user, 2)
      .then((todos) => todos.map((todo) => impl.updateTodo(todo.id, user, { status: 3})))
      .then((res) => {
        console.log('clearCompleted', res)
      })
  }
}

export const { storeTodo, indexTodos, updateTodo, clearCompletedTodos } = impl

