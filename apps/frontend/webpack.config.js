const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { join } = require('path');
const Dotenv = require('dotenv-webpack');

// Determine which environment file to use based on NODE_ENV
const getEnvFilePath = () => {
  const nodeEnv = process.env.NODE_ENV || 'development';

  // Define environment file paths in order of precedence
  const envFiles = [
    `.env.${nodeEnv}.local`, // .env.production.local, .env.development.local, etc.
    `.env.${nodeEnv}`, // .env.production, .env.development, etc.
    '.env.local', // .env.local (always loaded)
    '.env', // .env (default fallback)
  ];

  // Find the first existing environment file
  for (const envFile of envFiles) {
    const fs = require('fs');
    const envPath = join(__dirname, envFile);
    if (fs.existsSync(envPath)) {
      console.log(`[Webpack] Loading environment from: ${envFile}`);
      return envFile;
    }
  }

  console.log(
    '[Webpack] No environment file found, using system variables only'
  );
  return null;
};

module.exports = {
  output: {
    path: join(__dirname, 'dist'),
  },
  devServer: {
    port: 4200,
    historyApiFallback: {
      index: '/index.html',
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
  },
  plugins: [
    new NxAppWebpackPlugin({
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
      baseHref: '/',
      assets: ['./src/favicon.ico', './src/assets'],
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
    new NxReactWebpackPlugin({
      // Uncomment this line if you don't want to use SVGR
      // See: https://react-svgr.com/
      // svgr: false
    }),
    new Dotenv({
      path: getEnvFilePath(),
      safe: false, // Load .env.example if .env doesn't exist
      systemvars: true, // Load all system environment variables as well
      silent: false, // Hide any errors
      defaults: false, // Load .env.defaults if it exists
    }),
  ],
};
