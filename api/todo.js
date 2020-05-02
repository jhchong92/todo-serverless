'use strict';
import AJV from 'ajv'
import { response, dynamoError } from './response';
import { indexTodos, storeTodo } from '../repositories/todo'
import { createUser, createUserFromEvent, createUserFromAuthorizer } from '../factories/user';
const uuid = require('uuid');
const AWS = require('aws-sdk'); 

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const makeSchemaId = (schema) => `${schema.self.vendor}/${schema.self.name}/${schema.self.version}`

const todoScoreRequestSchema = require('../schemas/todo-store-request-schema.json')
const todoStoreRequestSchemaId = makeSchemaId(todoScoreRequestSchema)
const todoScoreSchema = require('../schemas/todo-store-schema.json')
const todoStoreSchemaId = makeSchemaId(todoScoreSchema)

const todosListSchema = require('../schemas/todos-list-schema.json')
const todosListSchemaId = makeSchemaId(todosListSchema)

const ajv = new AJV()
ajv.addSchema(todoScoreRequestSchema, todoStoreRequestSchemaId)
ajv.addSchema(todoScoreSchema, todoStoreSchemaId)
ajv.addSchema(todosListSchema, todosListSchemaId)

export const hello = async (event, context) => {
  console.log('hello', context)
  return {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: 'Go Serverless v1.0! Your function executed successfully!',
        input: event,
      },
      null,
      2
    ),
  };
};

const impl = {
  response: (statusCode, body) => ({
    statusCode,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, POST, DELETE, OPTIONS'
    },
    body
  }),
  successResponse: (message) => {
    return impl.response(200, JSON.stringify({
      message
    }))
  },
  serverError: (message) => {
    return impl.response(500, JSON.stringify({
      message 
    }))
  },
  dynamoError: (method, err) => {
    console.log(`${method} - dynamo error ${err}`)
    return impl.serverError('Something went wrong at server')
  },
  validationError: () => {
    return impl.response(400, JSON.stringify({
      message: 'Validation error'
    }))
  },
  clientError: (method, schemaId, ajvErrors, event) => {
    return impl.response(400, 
      `${method} Invalid Request could not validate request to schema ${schemaId}. Errors: '${ajvErrors}' found in event: '${JSON.stringify(event)}' `  
    )
  },
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
    const status = event.queryStringParameters && event.queryStringParameters.status;
    const user = createUserFromAuthorizer(event.requestContext.authorizer)
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

    // const taskName = body.taskName
    // const userId = event.requestContext.authorizer.claims.sub
    // submitTask(createTask(taskName, userId))
    //   .then((todo) => {
    //     callback(null, impl.successTodo(todo))
    //   })
    //   .catch((error) => {
    //     callback(null, impl.dynamoError('SUBMIT', error))
    //   })
  },
  update: (event, context, callback) => {
    const taskId = event.pathParameters.taskId;
    const status = event.pathParameters.status;
    
    const userId = event.requestContext.authorizer.claims.sub
    updateTaskStatus(userId, taskId, status)
    .then((todo) => {
      callback(null, impl.successTodo(todo))
    })
    .catch((err) => {
      callback(null, impl.dynamoError('UPDATE', err))
    })
  },
  clearCompleted: (event, context, callback) => {
    const userId = event.requestContext.authorizer.claims.sub
    listTodos(userId, 2).then((tasks) => tasks.map((task) => updateTaskStatus(userId, task.id, 3)))
    .then((tasks) => {
      console.log('tasks', tasks)
      callback(null, impl.successResponse('Success'))

    })
    .catch((err) => {
      callback(null, impl.serverError(err))
    })
  }
}

const listTodos = (userId, status) => {
  console.log('listTodos', userId, status);
  
  const payload = {
    TableName: process.env.TODO_TABLE,
  }
  let filterExpression = 'user_id = :userId'
  let expressionAttributeValues = {
    ':userId': userId
  }
  if (status) {
    filterExpression += ' AND task_status = :s'
    Object.assign(expressionAttributeValues, {
      ':s': parseInt(status)
    })
  }
  Object.assign(payload, {
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues
  })
  return dynamoDb.scan(payload).promise()
  .then (result => result.Items)
}


const submitTask = task => {
  console.log('Submitting task');
  const payload = {
    TableName: process.env.TODO_TABLE,
    Item: task,
  };
  return dynamoDb.put(payload).promise()
    .then(res => {
      return task
    });
};

const createTask = (taskName, userId) => {
  return {
    id: uuid.v1(),
    user_id: userId,
    task_name: taskName,
    task_status: 1
  }
}


const updateTaskStatus = (userId, taskId, status) => {
  console.log('updateTask', taskId, status)
  const payload = {
    TableName: process.env.TODO_TABLE,
    Key: {
      'id': taskId
    },
    UpdateExpression: 'SET task_status = :t',
    ConditionExpression: 'user_id = :userId',
    ExpressionAttributeValues: {
      ':t' : parseInt(status),
      ':userId': userId
    },
    ReturnValues: "ALL_NEW"
  }
  return dynamoDb.update(payload).promise()
    .then((res) => {
      console.log('update dynamo', res)
      return res.Attributes
    });
}

export const { list, submit, update, clearCompleted } = api
// export const { }
// module.exports = {
//   list: api.list,
//   submit: api.submit,
//   update: api.update,
//   clearCompleted: api.clearCompleted
// }