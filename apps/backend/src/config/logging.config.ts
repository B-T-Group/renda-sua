import { utilities as nestWinstonModuleUtilities } from 'nest-winston';
import * as winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';
import { getRequestLogContext } from '../common/request-context-log.util';

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

const requestContextFormat = winston.format((info) => {
  const ctx = getRequestLogContext();
  if (ctx.requestId) {
    info.requestId = ctx.requestId;
  }
  if (ctx.userId) {
    info.userId = ctx.userId;
  }
  return info;
});

/** Formats a Winston log info object as a single CloudWatch message string. */
export function formatCloudWatchMessage(
  item: Record<string, unknown>
): string {
  const { level, message, timestamp, ...meta } = item;
  return JSON.stringify({
    level,
    message,
    timestamp,
    ...meta,
  });
}

export const createWinstonConfig = (config: LoggingConfig) => {
  const transports: winston.transport[] = [];

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

  if (config.enableCloudWatch) {
    const cloudWatchOptions: Record<string, unknown> = {
      logGroupName: config.logGroupName,
      logStreamName: config.logStreamName,
      awsRegion: config.region,
      messageFormatter: formatCloudWatchMessage,
      errorHandler: (err: Error) => {
        console.error('CloudWatch logging error:', err);
      },
    };
    if (config.accessKeyId && config.secretAccessKey) {
      cloudWatchOptions.awsAccessKeyId = config.accessKeyId;
      cloudWatchOptions.awsSecretKey = config.secretAccessKey;
    }
    transports.push(new CloudWatchTransport(cloudWatchOptions as any));
  }

  return {
    level: config.logLevel,
    format: winston.format.combine(
      requestContextFormat(),
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    ),
    defaultMeta: { service: 'rendasua-backend' },
    transports,
    exceptionHandlers: transports,
    rejectionHandlers: transports,
  };
};
