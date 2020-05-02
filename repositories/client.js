const AWS = require('aws-sdk')
const docClient = new AWS.DynamoDB.DocumentClient()

export default docClient