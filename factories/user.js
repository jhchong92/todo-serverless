const createUser = ({id, name, email}) => ({
  id,
  name,
  email
})

const createUserFromEvent = (event) => {
  const { requestContext: { authorizer } }   = event
  return createUserFromAuthorizer(authorizer)
}

const createUserFromAuthorizer = (authorizer) => {
  const { claims } = authorizer
  return ({ 
    id: claims.sub,
    email: claims.email
  })
} 

export { createUser, createUserFromEvent, createUserFromAuthorizer }
