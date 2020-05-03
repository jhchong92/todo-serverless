'use strict';
import AJV from 'ajv'
import { response, dynamoError, serverError, successResponse } from './response';
import { indexTodos, storeTodo, updateTodo, clearCompletedTodos } from '../repositories/todo'
import { createUserFromEvent } from '../factories/user';
const AWS = require('aws-sdk'); 

AWS.config.setPromisesDependency(require('bluebird'));

const makeSchemaId = (schema) => `${schema.self.vendor}/${schema.self.name}/${schema.self.version}`

const ajv = new AJV()

const todoScoreRequestSchema = require('../schemas/todo-store-request-schema.json')
const todoStoreRequestSchemaId = makeSchemaId(todoScoreRequestSchema)
ajv.addSchema(todoScoreRequestSchema, todoStoreRequestSchemaId)

const todoScoreSchema = require('../schemas/todo-store-schema.json')
const todoStoreSchemaId = makeSchemaId(todoScoreSchema)
ajv.addSchema(todoScoreSchema, todoStoreSchemaId)

const todosListSchema = require('../schemas/todos-list-schema.json')
const todosListSchemaId = makeSchemaId(todosListSchema)
ajv.addSchema(todosListSchema, todosListSchemaId)

const todoUpdateRequestSchema = require('../schemas/todo-update-request-schema.json')
const todoUpdateRequestSchemaId = makeSchemaId(todoUpdateRequestSchema)
ajv.addSchema(todoUpdateRequestSchema, todoUpdateRequestSchemaId)

const impl = {
  successTodos: (todos) => {
    return response(200, JSON.stringify({
      message: 'Success',
      todos
    }))
  },
  successTodo: (todo) => {
    return response(200, JSON.stringify({
      message: 'Success',
      data: todo
    }))
  }
}

const api = {
  list: (event, context, callback) => {
    console.log('authorizer', event.requestContext.authorizer);
    if (!ajv.validate(todosListSchemaId, event)) {
      callback(null, impl.clientError('LIST_TODO', todosListSchemaId, ajv.errorsText(), event))
      return
    }
    const user = createUserFromEvent(event)
    const status = event.queryStringParameters && event.queryStringParameters.status
    indexTodos(user, status)
      .then((todos) => {
        callback(null, impl.successTodos(todos))
      })
      .catch((error) => {
        callback(null, dynamoError('LIST_TODO', error))
      })
  }, 
  submit: (event, context, callback) => {
    if (!ajv.validate(todoStoreRequestSchemaId, event)) {
      callback(null, impl.clientError('SUBMIT_TODO', todoStoreRequestSchemaId, ajv.errorsText(), event))
      return;
    }
    const user = createUserFromEvent(event)
    const body = JSON.parse(event.body)
    if (!ajv.validate(todoStoreSchemaId, body)) {
      callback(null, impl.clientError('SUBMIT_TODO', todoStoreSchemaId, ajv.errorsText(), event))
      return;
    }
    const taskName = body.taskName

    storeTodo(user, taskName)
      .then((todo) => {
        callback(null, impl.successTodo(todo))
      })
      .catch((error) => {
        callback(null, impl.dynamoError('SUBMIT', error))
      })

  },
  update: (event, context, callback) => {
    if (!ajv.validate(todoUpdateRequestSchemaId, event)) {
      callback(null, impl.clientError('UPDATE_TODO', todoUpdateRequestSchemaId, ajv.errorsText(), event))
      return
    }
    const { todoId, status } = event.pathParameters;
    
    const user = createUserFromEvent(event)
    // const userId = event.requestContext.authorizer.claims.sub
    updateTodo(todoId, user, { status })
      .then((todo) => {
        callback(null, impl.successTodo(todo))
      })
      .catch((err) => {
        callback(null, serverError('UPDATE_TODO', err))
      })
  },
  clearCompleted: (event, context, callback) => {
    const user = createUserFromEvent(event)
    clearCompletedTodos(user)
      .then(() => {
        callback(null, successResponse('Success'))
      })
      .catch((err) => {
        callback(null, serverError('CLEAR_COMPLETED', err))
      })
  }
}

export const { list, submit, update, clearCompleted } = api
