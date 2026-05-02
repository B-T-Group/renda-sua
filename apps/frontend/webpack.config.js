const { NxAppWebpackPlugin } = require('@nx/webpack/app-plugin');
const { NxReactWebpackPlugin } = require('@nx/react/webpack-plugin');
const { join } = require('path');
const zlib = require('zlib');

const isProd = process.env['NODE_ENV'] === 'production';

const compressionPlugins = isProd
  ? (() => {
      const CompressionPlugin = require('compression-webpack-plugin');
      return [
        new CompressionPlugin({
          filename: '[path][base].gz',
          algorithm: 'gzip',
          test: /\.(js|css|html|svg|json)$/,
          threshold: 1024,
          minRatio: 0.85,
        }),
        new CompressionPlugin({
          filename: '[path][base].br',
          algorithm: 'brotliCompress',
          test: /\.(js|css|html|svg|json)$/,
          threshold: 1024,
          minRatio: 0.85,
          compressionOptions: {
            params: {
              [zlib.constants.BROTLI_PARAM_QUALITY]: 11,
            },
          },
        }),
      ];
    })()
  : [];

const analyzerPlugins =
  process.env['ANALYZE'] === 'true'
    ? [
        new (require('webpack-bundle-analyzer').BundleAnalyzerPlugin)({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: join(
            __dirname,
            '../../dist/apps/frontend/report.html'
          ),
        }),
      ]
    : [];

module.exports = {
  output: {
    path: join(__dirname, '../../dist/apps/frontend'),
  },
  devServer: {
    port: 4200,
    historyApiFallback: {
      index: '/index.html',
      disableDotRule: true,
      htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'],
    },
    static: {
      directory: join(__dirname, 'public'),
      publicPath: '/',
    },
  },
  ...(isProd
    ? {
        optimization: {
          runtimeChunk: 'single',
          moduleIds: 'deterministic',
          splitChunks: {
            chunks: 'all',
            maxInitialRequests: 25,
            minSize: 20000,
            cacheGroups: {
              react: {
                test: /[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
                name: 'vendor-react',
                priority: 50,
              },
              muiCore: {
                test: /[\\/]node_modules[\\/](@mui[\\/](material|lab|system|base|private-theming|styled-engine)|@emotion)[\\/]/,
                name: 'vendor-mui-core',
                priority: 45,
              },
              muiIcons: {
                test: /[\\/]node_modules[\\/]@mui[\\/]icons-material[\\/]/,
                name: 'vendor-mui-icons',
                priority: 44,
              },
              muiX: {
                test: /[\\/]node_modules[\\/]@mui[\\/]x-(data-grid|date-pickers|date-pickers-pro)[\\/]/,
                name: 'vendor-mui-x',
                priority: 43,
              },
              apollo: {
                test: /[\\/]node_modules[\\/](@apollo|graphql|graphql-ws|graphql-request|zen-observable)[\\/]/,
                name: 'vendor-apollo',
                priority: 40,
              },
              i18n: {
                test: /[\\/]node_modules[\\/](i18next|react-i18next|i18next-browser-languagedetector|i18next-http-backend)[\\/]/,
                name: 'vendor-i18n',
                priority: 35,
              },
              auth0: {
                test: /[\\/]node_modules[\\/]@auth0[\\/]/,
                name: 'vendor-auth0',
                priority: 35,
              },
              charts: {
                test: /[\\/]node_modules[\\/](apexcharts|react-apexcharts)[\\/]/,
                name: 'vendor-charts',
                priority: 30,
                chunks: 'async',
              },
              calendar: {
                test: /[\\/]node_modules[\\/]@fullcalendar[\\/]/,
                name: 'vendor-calendar',
                priority: 30,
                chunks: 'async',
              },
              pdf: {
                test: /[\\/]node_modules[\\/](react-pdf|pdfjs-dist)[\\/]/,
                name: 'vendor-pdf',
                priority: 30,
                chunks: 'async',
              },
              countries: {
                test: /[\\/]node_modules[\\/]country-state-city[\\/]/,
                name: 'vendor-countries',
                priority: 30,
                chunks: 'async',
              },
              whatsapp: {
                test: /[\\/]node_modules[\\/]@digicroz[\\/]/,
                name: 'vendor-whatsapp',
                priority: 30,
                chunks: 'async',
              },
              defaultVendors: {
                test: /[\\/]node_modules[\\/]/,
                name: 'vendor-misc',
                priority: 10,
                reuseExistingChunk: true,
              },
            },
          },
        },
      }
    : {}),
  plugins: [
    new NxAppWebpackPlugin({
      name: 'frontend',
      tsConfig: './tsconfig.app.json',
      compiler: 'babel',
      main: './src/main.tsx',
      index: './src/index.html',
      baseHref: '/',
      assets: ['./src/favicon.ico', './src/assets', './public'],
      styles: ['./src/styles.css'],
      outputHashing: process.env['NODE_ENV'] === 'production' ? 'all' : 'none',
      optimization: process.env['NODE_ENV'] === 'production',
    }),
    new NxReactWebpackPlugin({}),
    ...compressionPlugins,
    ...analyzerPlugins,
  ],
};
