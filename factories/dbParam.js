const createDbParam = (tableName, filterExpression, expressionAttributeValues) => ({
  TableName: tableName,
  FilterExpression: filterExpression,
  ExpressionAttributeValues: expressionAttributeValues
})

export { createDbParam }