'use strict';

const AJV = require('ajv');
const uuid = require('uuid');
const AWS = require('aws-sdk'); 

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

const makeSchemaId = (schema) => `${schema.self.vendor}/${schema.self.name}/${schema.self.version}`

const todoCreateSchema = require('../schemas/todo-create-schema.json')
const todoCreateSchemaId = makeSchemaId(todoCreateSchema)

const todosListSchema = require('../schemas/todos-list-schema.json')
const todosListSchemaId = makeSchemaId(todosListSchema)

const ajv = new AJV()
ajv.addSchema(todoCreateSchema, todoCreateSchemaId)
ajv.addSchema(todosListSchema, todosListSchemaId)

module.exports.hello = async (event, context) => {
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

    return impl.response(200, JSON.stringify({
      message: 'Success',
      todos
    }))
  },
  successTodo: (todo) => {
    return impl.response(200, JSON.stringify({
      message: 'Success',
      data: todo
    }))
  }
}

const api = {
  list: (event, context, callback) => {
    console.log('abc');
    if (!ajv.validate(todosListSchemaId, event)) {
      callback(null, impl.clientError('LIST_TODO', todosListSchemaId, ajv.errorsText(), event))
      return
    }
    console.log('list', event)
    let status = null;
    if (event.queryStringParameters) {
      status = event.queryStringParameters.status
    }
    const userId = event.requestContext.authorizer.claims.sub
    console.log('userId', userId)
    listTodos(userId, status).then((todos) => {
      console.log('listTodos results', todos)
      callback(null, impl.successTodos(todos))
    }).catch((error) => {
      console.log('error', error)
      callback(null, impl.dynamoError('LIST', error))
    })
  }, 
  submit: (event, context, callback) => {
    if (!ajv.validate(todoCreateSchemaId, event)) {
      callback(null, impl.clientError('SUBMIT_TODO', todoCreateSchemaId, ajv.errorsText(), event))
      return;
    }
    const body = JSON.parse(event.body);
    const taskName = body.taskName
    
    if (typeof taskName !== 'string') {
      callback(null, impl.validationError());
    }
    const userId = event.requestContext.authorizer.claims.sub
    submitTask(createTask(taskName, userId))
    .then((todo) => {
      callback(null, impl.successTodo(todo))
    })
    .catch((error) => {
      callback(null, impl.dynamoError('SUBMIT', error))
    })
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

module.exports = {
  list: api.list,
  submit: api.submit,
  update: api.update,
  clearCompleted: api.clearCompleted
}