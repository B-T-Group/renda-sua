import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';

export interface LoggingConfig {
  logGroupName: string;
  logStreamName: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  logLevel: string;
  enableCloudWatch: boolean;
  enableConsole: boolean;
}

export const createWinstonConfig = (config: LoggingConfig) => {
  const transports: winston.transport[] = [];

  // Console transport for local development
  if (config.enableConsole) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.ms(),
          nestWinstonModuleUtilities.format.nestLike('RendasuaBackend', {
            colors: true,
            prettyPrint: true,
            processId: true,
            appName: true,
          })
        ),
      })
    );
  }

  // CloudWatch transport for production
  if (config.enableCloudWatch && config.accessKeyId && config.secretAccessKey) {
    transports.push(
      new CloudWatchTransport({
        logGroupName: config.logGroupName,
        logStreamName: config.logStreamName,
        awsRegion: config.region,
        awsAccessKeyId: config.accessKeyId,
        awsSecretKey: config.secretAccessKey,
        messageFormatter: (item: any) => {
          return `[${item.level}]: ${item.message}`;
        },
        errorHandler: (err: any) => {
          console.error('CloudWatch logging error:', err);
        },
      })
    );
  }

  return {
    level: config.logLevel,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'rendasua-backend' },
    transports,
    // Handle uncaught exceptions and unhandled rejections
    exceptionHandlers: transports,
    rejectionHandlers: transports,
  };
};
