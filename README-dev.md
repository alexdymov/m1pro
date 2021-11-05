# m1pro dev

## Prerequisites
 - Install [Node.js] which includes [Node Package Manager][npm]

## Build
Install dependencies
```
npm install
```
For developement mode run
```
npm run dev
```
For production release run
```
npm run build   
```

## Notes
if you encounter such error during the build:
```
[webpack-cli] HookWebpackError: item.node is not a function
    at makeWebpackError (D:\Work\webpack-sources-issue\node_modules\webpack\lib\HookWebpackError.js:49:9)
    at D:\Work\webpack-sources-issue\node_modules\webpack\lib\Compilation.js:1995:11
    at eval (eval at create (D:\Work\webpack-sources-issue\node_modules\tapable\lib\HookCodeFactory.js:33:10), <anonymous>:17:1)
    at processTicksAndRejections (node:internal/process/task_queues:94:5)
-- inner error --
TypeError: item.node is not a function
    at D:\work\webpack-sources-issue\node_modules\webpack-sources\lib\ConcatSource.js:59:50
    at Array.map (<anonymous>)
...
```
Make sure you have [this](https://github.com/levp/wrapper-webpack-plugin/pull/16) PR applied

[node.js]: https://nodejs.org/
[npm]: https://www.npmjs.com/get-npm
