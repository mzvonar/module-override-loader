# module-override-loader

This loader works with `module-override-webpack-plugin` and `css-module-override-webpack-plugin`.
It loads overrides for provided modules and the plugins then create additional bundles.

## Install
```bash
npm install module-override-loader --save-dev
```

## Usage


```js
const ModuleOverrideWebpackPlugin = require('module-override-webpack-plugin');

module.exports = {
    module: {
        rules: [
            {
                test: /\.js$/,
                use: [
                    {
                        loader: 'module-override-loader',
                        options: {
                            overrides: ['batman', 'superman'],
                            pattern: '[name].[override].[ext]'
                        }
                    },
                    'babel-loader'
                ]
            }
        ]
    }
}
```

See [ModuleOverrideWebpackPlugin](https://github.com/mzvonar/module-override-webpack-plugin) for more details.

## Debug
You can use `debug` library with namespace `css-module-override-webpack-plugin`. `debug` is optional dependency. You have to install it yourself if you want to use it.