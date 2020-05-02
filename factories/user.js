const createUser = ({id, name, email}) => ({
  id,
  name,
  email
})

const createUserFromAuthorizer = (authorizer) => {
  const { claims } = authorizer
  return ({ 
    id: claims.sub,
    email: claims.email
  })
} 

export { createUser, createUserFromAuthorizer }
