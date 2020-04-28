const createUser = ({id, name, email}) => ({
  id,
  name,
  email
})

const createUserFromAuthorizer = (authorizer) => ({
  id: authorizer.sub,
  email: authorizer.email
})

export { createUser, createUserFromAuthorizer }
