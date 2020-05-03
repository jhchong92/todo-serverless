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
  serverError: (method, err) => {
    console.log(`${method} - server error ${err}`)
    return impl.response(500, JSON.stringify({
      err
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
}

export const { 
  response, successResponse, serverError, dynamoError, validationError, 
  clientError
} = impl