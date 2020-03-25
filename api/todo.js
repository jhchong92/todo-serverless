'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk'); 

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

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
    },
    body
  }),
  serverError: (message) => {
    return impl.response(500, {
      message 
    })
  },
  dynamoError: (method, err) => {
    console.log(`${method} - dynamo error ${err}`)
    return impl.serverError('Something went wrong at server')
  },
  validationError: () => {
    return impl.response(400, {
      message: 'Validation error'
    })
  },
  successTodos: (todos) => {
    return impl.response(200, {
      message: 'Success',
      todos
    })
  },
  successTodo: (todo) => {
    return impl.response(200, {
      message: 'Success',
      todo
    })
  }
}

const api = {
  list: (event, context, callback) => {
    console.log('list', event)
    let status = null;
    if (event.queryStringParameters) {
      status = event.queryStringParameters.status
    }
    const userId = event.requestContext.authorizer.claims.sub
    listTodos(userId, status).then((todos) => {
      callback(null, impl.successTodos(todos))
    }).catch((error) => {
      callback(null, impl.dynamoError('LIST', error))
    })
  }, 
  submit: (event, context, callback) => {
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

  }
}

const listTodos = (userId, status) => {
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

/**
 * Update task status
 */

module.exports.update = async (event, context, callback) => {
  console.log('update', event)
  const taskId = event.pathParameters.taskId;
  const status = event.pathParameters.status;

  // TODO: validate task and status

  try {
    const userId = event.requestContext.authorizer.claims.sub
    const task = await updateTaskStatus(userId, taskId, status)
    console.log('done!', task)
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Success',
          data: task
        }
      ),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    })
  }catch (err) {
    // handle condition check failed (invalid userId)
    console.log(err)
    callback(null, {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: 'Unable to update task',
        }
      ),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    })
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

/**
 * Clear all completed task
 */
module.exports.clearCompleted = async (event, context, callback) => {
  // get all user's tasks
  const userId = event.requestContext.authorizer.claims.sub
  const tasks = await listTodos(userId, 2);
  console.log('tasks list', tasks)
  try {
    const update = await Promise.all(tasks.map((task) => updateTaskStatus(userId, task.id, 3)))
    // const task = await updateTaskStatus(taskId, status)
    console.log('done!', update)
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Submitted',
          data: update
        }
      ),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    })
  }catch (err) {
    console.log(err)
    callback(null, {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: 'Unable to update task',
        }
      ),
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Credentials': true,
      },
    })
  }
}

module.exports = {
  list: api.list
}