const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { join } = require('path');

module.exports = (options, context) => {
  const isWatch = context?.watch || process.env.NODE_ENV === 'development';

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
