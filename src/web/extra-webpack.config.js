const TerserPlugin = require('terser-webpack-plugin');
const webpack = require('webpack');

module.exports = {
    resolve: {
        fallback: {
            "querystring": require.resolve("querystring-es3"),
            "crypto": require.resolve("crypto-browserify"),
            "stream": require.resolve("stream-browserify"),
            "timers": require.resolve("timers-browserify"),
            "vm": require.resolve("vm-browserify"),
            "path": require.resolve("path-browserify"),
            "util": require.resolve("util/"),
            // "mime-types": require.resolve("browserify-mime")
        }
    },
    plugins: [
        new webpack.ProvidePlugin({
            'process': 'process/browser'
        }),
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ],
};