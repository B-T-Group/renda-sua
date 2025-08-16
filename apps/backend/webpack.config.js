const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = (options, context) => {
  // Only enable watch mode if explicitly requested via context.watch
  // Don't enable watch mode just because NODE_ENV is development
  const isWatch = context?.watch || false;

  return {
    output: {
      path: join(__dirname, '../../dist/apps/backend'),
    },
    watch: isWatch,
    watchOptions: isWatch
      ? {
          ignored: /node_modules/,
          poll: 1000,
        }
      : false,
    plugins: [
      new NxAppWebpackPlugin({
        target: 'node',
        compiler: 'tsc',
        main: './src/main.ts',
        tsConfig: './tsconfig.app.json',
        assets: ['./src/assets'],
        optimization: false,
        outputHashing: 'none',
        generatePackageJson: true,
      }),
    ],
  };
};
