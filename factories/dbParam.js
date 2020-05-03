const createDbParam = (tableName, filterExpression, expressionAttributeValues) => {
  
  return {
    TableName: tableName,
    FilterExpression: filterExpression,
    ExpressionAttributeValues: expressionAttributeValues
  }
} 

export { createDbParam }