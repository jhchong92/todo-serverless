var nodeExternals = require('webpack-node-externals')
const path = require('path')
const slsw = require('serverless-webpack')

console.log('nodeExternals', nodeExternals())
module.exports = {
  entry: slsw.lib.entries,
  target: 'node',
  mode: 'none',
  externals: [nodeExternals()],
  output: {
    libraryTarget: 'commonjs',
    path: path.join(__dirname, '.webpack'),
    filename: '[name].js'
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        use: [
          {
            loader: 'babel-loader',
            options: {
              presets: [
                ['@babel/env', { targets: { node: '12'}}]
              ]
            }
          }
        ]
      }
    ]

  }
}