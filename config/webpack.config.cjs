const rpath = require('path');
const fs = require('fs');
const { merge } = require('webpack-merge');
const LiveReloadPlugin = require('webpack-livereload-plugin');
const UserScriptMetaDataPlugin = require('userscript-metadata-webpack-plugin');
const GenerateJsonWebpackPlugin = require('generate-json-webpack-plugin');
const WrapperPlugin = require('wrapper-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
const RemovePlugin = require('remove-files-webpack-plugin');
const { DefinePlugin } = require('webpack');

const createVariants = require('parallel-webpack').createVariants;
const { version, description, name } = require('../package.json');

const webpackConfig = require('./webpack.config.base.cjs');
const dist = rpath.resolve(__dirname, '../dist');

function createConfig(options) {
  const plugins = [
    new DefinePlugin({
      VERSION: JSON.stringify(version)
    })
  ];

  const entry = './src/index.ts';

  let tcfg;
  if (options.target === 'user') {
    const filename = `${options.prod ? name : 'index'}.prod.user.js`;
    const metadata = require('./metadata.cjs');
    metadata.icon = 'data:image/png;base64,' + fs.readFileSync(`./assets/images/icon64.png`).toString('base64');
    const empty = rpath.resolve(__dirname, './empty.cjs');
    const path = dist;

    plugins.push(new WrapperPlugin({
      test: new RegExp(`${filename}$`),
      header: `
        Object.defineProperty(window, "Vue", {
          configurable: true,
            set(v) {
              Object.defineProperty(window, "Vue", { configurable: true, enumerable: true, writable: true, value: v });
              `,
      footer: `
            }
        });`
    }));

    if (options.prod) {
      tcfg = { entry, output: { filename, path } };
    } else {
      plugins.push(new LiveReloadPlugin({ delay: 500 }));
      metadata.require.push(`file://${dist}/${filename}`);
      metadata.name += '-dev'
      tcfg = {
        entry: { prod: entry, dev: empty },
        output: { filename: 'index.[name].user.js', path, publicPath: '' }
      };
    }

    plugins.push(new UserScriptMetaDataPlugin({ metadata }));
  } else {
    const subfolder = options.prod ? '/temp' : '';
    const path = `${dist}${subfolder}/${options.target}`;
    tcfg = {
      entry: { main: './src/index.main.ts', game: './src/index.game.ts' },
      output: { filename: 'script.[name].js', path, publicPath: '' }
    };
    plugins.push(new GenerateJsonWebpackPlugin(
      `manifest.json`,
      merge(
        require('../assets/manifest/common.json'),
        require(`../assets/manifest/${options.target}.json`),
        { version, description, name }
      ),
      null,
      2
    ));
    // to use with webpack 5+ and wrapper 2.2- do apply https://github.com/levp/wrapper-webpack-plugin/pull/16
    plugins.push(new WrapperPlugin({
      test: /\.js$/,
      header: `var scriptCode = '(' + function() {
        Object.defineProperty(window, "Vue", {
          configurable: true,
            set(v) {
              Object.defineProperty(window, "Vue", { configurable: true, enumerable: true, writable: true, value: v });
      `,
      footer: `
            }
          });
        } + ')();';
        var script = document.createElement('script');
        script.textContent = scriptCode;
        (document.head||document.documentElement).appendChild(script);
        script.remove();
        `
    }));
    plugins.push(new CopyPlugin({
      patterns: [{
        context: './assets/images',
        from: '*.png',
        to: ''
      }]
    }));

    if (options.prod) {
      plugins.push(new ZipPlugin({
        path: '../..',
        filename: `${name}-${options.target}.zip`
      }));
      if (options.target !== 'firefox') {
        plugins.push(new RemovePlugin({
          after: {
            include: [path]
          }
        }));
      }
    }
  }

  const mode = options.prod ? 'production' : 'development';
  const pcfg = options.prod ? {} : {
    devtool: 'inline-source-map',
    watch: true,
    watchOptions: {
      ignored: /node_modules/,
    }
  };
  return merge(webpackConfig, tcfg, pcfg, { mode, plugins });
}

const variants = {
  prod: [process.argv.indexOf('--prod') > 0],
  target: ['user', 'chrome', 'firefox']
}

module.exports = createVariants({}, variants, createConfig);