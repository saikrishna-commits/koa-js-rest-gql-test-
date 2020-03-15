const { gql } = require("apollo-server-koa")

//* gql types

const typeDefs = gql`
  type Query {
    hello: String
  }
`;


module.exports = { typeDefs }