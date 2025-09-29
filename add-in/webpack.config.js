const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const path = require('path');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      taskpane: ['./src/taskpane/unlimitedExecutor.js', './src/taskpane/taskpane.js'],
      commands: './src/commands/commands.js',
      'excel-functions': './src/functions/excel-functions.js'
    },

    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true,
      publicPath: '/'
    },

    resolve: {
      extensions: ['.js', '.html', '.css']
    },

    module: {
      rules: [
        {
          test: /\.html$/,
          use: 'html-loader'
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader']
        },
        {
          test: /\.(png|jpg|jpeg|gif|svg|ico)$/,
          type: 'asset/resource',
          generator: {
            filename: 'assets/[name][ext]'
          }
        }
      ]
    },

    plugins: [
      // Generate HTML files
      new HtmlWebpackPlugin({
        filename: 'taskpane.html',
        template: './src/taskpane/taskpane.html',
        chunks: ['taskpane'],
        inject: 'body'
      }),

      new HtmlWebpackPlugin({
        filename: 'commands.html',
        template: './src/commands/commands.html',
        chunks: ['commands'],
        inject: false,
        templateParameters: {
          'commands.js': isProduction ? 'commands.js' : 'commands.js'
        }
      }),

      // Copy static assets
      new CopyWebpackPlugin({
        patterns: [
          {
            from: 'assets',
            to: 'assets',
            noErrorOnMissing: true
          },
          {
            from: 'manifest.xml',
            to: 'manifest.xml'
          }
        ]
      })
    ],

    devServer: {
      port: 3000,
      https: true,
      static: {
        directory: path.join(__dirname, 'dist')
      },
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers': 'X-Requested-With, content-type'
      },
      proxy: {
        '/api': {
          target: 'https://us-central1-aibun-ai.cloudfunctions.net',
          secure: true,
          changeOrigin: true
        }
      },
      allowedHosts: 'all',
      client: {
        overlay: {
          errors: true,
          warnings: false
        }
      }
    },

    optimization: {
      splitChunks: false, // Keep everything in separate bundles for Office.js
      minimize: isProduction
    },

    performance: {
      hints: false
    },

    stats: {
      errorDetails: true
    }
  };
};