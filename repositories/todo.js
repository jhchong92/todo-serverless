import client from "./client";
import { createDbParam } from "../factories/dbParam";

const TABLE_NAME = process.env.TODO_TABLE

const impl = {
  save: () => {
    
  },
  index: async (user, status) => {
    let filterExprs = 'user_id = :userId'
    const exprAttrValues = {
      ':userId': user.id
    }
    if (status) {
      filterExprs += ' AND task_status = :s'
      Object.assign(exprAttrValues, {
        ':s': parseInt(status)
      })
    }
    const param = createDbParam(TABLE_NAME, filterExprs, exprAttrValues)
    console.log('db scan params', param)
    return client.scan(param).promise()
    .then(result => result.Items)
  }
}

export const { save, index } = impl

