import {
  SFNClient,
  StartExecutionCommand,
  StartExecutionCommandInput,
} from '@aws-sdk/client-sfn';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../config/configuration';

export interface WaitExecutePayload {
  order_id: string;
  transaction_id: string;
}

@Injectable()
export class WaitAndExecuteScheduleService {
  private readonly logger = new Logger(WaitAndExecuteScheduleService.name);
  private sfnClient: SFNClient;
  private stateMachineArn: string | undefined;

  constructor(private readonly configService: ConfigService<Configuration>) {
    const awsConfig = this.configService.get<Configuration['aws']>('aws');
    const region =
      awsConfig?.region ||
      process.env.AWS_REGION ||
      'ca-central-1';
    this.sfnClient = new SFNClient({ region });
    this.stateMachineArn =
      process.env.WAIT_EXECUTE_STATE_MACHINE_ARN ??
      process.env.PAYMENT_TIMEOUT_STATE_MACHINE_ARN;
    if (!this.stateMachineArn) {
      this.logger.warn(
        'WAIT_EXECUTE_STATE_MACHINE_ARN / PAYMENT_TIMEOUT_STATE_MACHINE_ARN not configured. Payment timeout scheduling will be skipped.'
      );
    } else {
      this.logger.log(
        `Wait-and-execute state machine configured: ${this.stateMachineArn}`
      );
    }
  }

  /**
   * Schedule a wait-and-execute execution (e.g. payment timeout).
   * Uses configurable waitMinutes from config (order.paymentTimeoutWaitMinutes, default 5).
   * On failure, logs only; does not throw.
   */
  async schedulePaymentTimeout(
    eventType: 'order.created' | 'order.claim_initiated',
    payload: WaitExecutePayload,
    waitMinutes?: number
  ): Promise<void> {
    if (!this.stateMachineArn) {
      this.logger.debug(
        'Skipping payment timeout schedule: state machine ARN not configured'
      );
      return;
    }

    const orderConfig = this.configService.get<Configuration['order']>('order');
    const minutes =
      waitMinutes ?? orderConfig?.paymentTimeoutWaitMinutes ?? 5;
    const runAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();

    const input = {
      event_type: eventType,
      payload,
      run_at: runAt,
    };

    try {
      const cmdInput: StartExecutionCommandInput = {
        stateMachineArn: this.stateMachineArn,
        input: JSON.stringify(input),
      };
      const command = new StartExecutionCommand(cmdInput);
      const response = await this.sfnClient.send(command);

      this.logger.log(
        `Scheduled ${eventType} timeout for order ${payload.order_id}, execution ${response.executionArn}, run_at=${runAt}, waitMinutes=${minutes}`
      );
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(
        `Failed to schedule ${eventType} timeout for order ${payload.order_id}: ${msg}`,
        stack
      );
    }
  }
}
