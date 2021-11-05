const path = require('path')
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')

const webpackConfig = {
  resolve: {
    extensions: ['.js', '.ts']
  },
  optimization: {
    minimize: false,
    moduleIds: 'named',
  },
  output: {
    path: path.resolve(__dirname, '../dist')
  },
  externals: {
    vue: 'Vue',
    jquery: 'jQuery',
  },
  module: {
    rules: [
      {
        use: {
          loader: 'babel-loader',
        },
        test: /\.js$/,
      },
      {
        test: /\.ts$/,
        loader: 'ts-loader'
      },
      {
        test: /\.less$/,
        use: [
          'style-loader',
          'css-loader',
          'less-loader', // Compiler Less to CSS
        ]
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          'css-loader',
        ]
      }
    ]
  },
  plugins: process.env.npm_config_report ? [new BundleAnalyzerPlugin()] : [],
}

module.exports = webpackConfig
