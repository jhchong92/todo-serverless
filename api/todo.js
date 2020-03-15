'use strict';

const uuid = require('uuid');
const AWS = require('aws-sdk'); 

AWS.config.setPromisesDependency(require('bluebird'));

const dynamoDb = new AWS.DynamoDB.DocumentClient();

module.exports.hello = async event => {
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

  // Use this code if you don't use the http event with the LAMBDA-PROXY integration
  // return { message: 'Go Serverless v1.0! Your function executed successfully!', event };
};

/**
 * Submit/Create new task
 */
module.exports.submit = async (event, context, callback) => {
  const taskName = event.body.taskName;
  if (typeof taskName !== 'string') {
    console.error('Validation failed');
    callback(new Error('Validation error'));
    return;
  }

  try {
    const task = await submitTask(createTask(taskName))
    console.log('done!', task)
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Submitted',
          taskId: task.id
        }
      )
    })
  }catch (err) {
    console.log(err)
    callback(null, {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: 'Unable to submit new task',
        }
      )
    })
  }
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

const createTask = (taskName) => {
  return {
    id: uuid.v1(),
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
    const task = await updateTaskStatus(taskId, status)
    console.log('done!', task)
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(
        {
          message: 'Submitted',
          taskId: task.id
        }
      )
    })
  }catch (err) {
    console.log(err)
    callback(null, {
      statusCode: 500,
      body: JSON.stringify(
        {
          message: 'Unable to update task',
        }
      )
    })
  }
}

const updateTaskStatus = (taskId, status) => {
  console.log('updateTask', taskId, status)
  const payload = {
    TableName: process.env.TODO_TABLE,
    Key: {
      'id': taskId
    },
    UpdateExpression: 'SET task_status = :t',
    ExpressionAttributeValues: {
      ':t' : status
    },
    ReturnValues: "ALL_NEW"
  }
  return dynamoDb.update(payload).promise()
    .then((res) => {
      console.log('update dynamo', res)
      return res.Attributes
    });
}