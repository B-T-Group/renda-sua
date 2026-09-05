import { Injectable } from '@nestjs/common';
import { HasuraSystemService } from '../hasura/hasura-system.service';
import {
  SIGNUP_ATTEMPT_TTL_MS,
  type SignupAttemptChannel,
  type SignupAttemptPayload,
  type SignupAttemptRow,
  type SignupAttemptStatus,
  type SignupCompletionResult,
} from './signup-attempt.types';

const ATTEMPT_FIELDS = `
  id
  channel
  contact_value
  payload
  status
  expires_at
  last_otp_sent_at
  verify_attempt_count
  auth0_verified_at
  completed_user_id
  completion_result
  created_at
  updated_at
`;

@Injectable()
export class SignupAttemptStore {
  constructor(private readonly hasura: HasuraSystemService) {}

  async insertPending(input: {
    channel: SignupAttemptChannel;
    contactValue: string;
    payload: SignupAttemptPayload;
  }): Promise<SignupAttemptRow> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SIGNUP_ATTEMPT_TTL_MS).toISOString();
    const nowIso = now.toISOString();
    const result = await this.hasura.executeMutation<{
      insert_signup_attempts_one: SignupAttemptRow;
    }>(
      `
      mutation InsertSignupAttempt(
        $channel: String!
        $contact: String!
        $payload: jsonb!
        $expires_at: timestamptz!
        $sent_at: timestamptz!
      ) {
        insert_signup_attempts_one(object: {
          channel: $channel
          contact_value: $contact
          payload: $payload
          status: "pending"
          expires_at: $expires_at
          last_otp_sent_at: $sent_at
        }) {
          ${ATTEMPT_FIELDS}
        }
      }
    `,
      {
        channel: input.channel,
        contact: input.contactValue,
        payload: input.payload,
        expires_at: expiresAt,
        sent_at: nowIso,
      }
    );
    return result.insert_signup_attempts_one;
  }

  async findById(id: string): Promise<SignupAttemptRow | null> {
    const result = await this.hasura.executeQuery<{
      signup_attempts_by_pk: SignupAttemptRow | null;
    }>(
      `
      query SignupAttemptById($id: uuid!) {
        signup_attempts_by_pk(id: $id) {
          ${ATTEMPT_FIELDS}
        }
      }
    `,
      { id }
    );
    return result.signup_attempts_by_pk;
  }

  async supersedePendingForContact(contactValue: string): Promise<void> {
    const nowIso = new Date().toISOString();
    await this.hasura.executeMutation(
      `
      mutation SupersedeSignupAttempts($contact: String!, $now: timestamptz!) {
        update_signup_attempts(
          where: {
            contact_value: { _eq: $contact }
            status: { _in: ["pending", "verifying", "verified_pending_provision"] }
          }
          _set: { status: "superseded", updated_at: $now }
        ) {
          affected_rows
        }
      }
    `,
      { contact: contactValue, now: nowIso }
    );
  }

  async markOtpSent(id: string): Promise<SignupAttemptRow | null> {
    const nowIso = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_signup_attempts_by_pk: SignupAttemptRow | null;
    }>(
      `
      mutation MarkSignupOtpSent($id: uuid!, $now: timestamptz!) {
        update_signup_attempts_by_pk(
          pk_columns: { id: $id }
          _set: { last_otp_sent_at: $now, updated_at: $now }
        ) {
          ${ATTEMPT_FIELDS}
        }
      }
    `,
      { id, now: nowIso }
    );
    return result.update_signup_attempts_by_pk;
  }

  async bumpVerifyCount(id: string): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_signup_attempts_by_pk: { verify_attempt_count: number } | null;
    }>(
      `
      mutation BumpSignupVerifyCount($id: uuid!, $now: timestamptz!) {
        update_signup_attempts_by_pk(
          pk_columns: { id: $id }
          _inc: { verify_attempt_count: 1 }
          _set: { updated_at: $now }
        ) {
          verify_attempt_count
        }
      }
    `,
      { id, now: nowIso }
    );
    return result.update_signup_attempts_by_pk?.verify_attempt_count ?? 0;
  }

  async updateStatus(
    id: string,
    status: SignupAttemptStatus,
    extra?: {
      auth0VerifiedAt?: string;
      completedUserId?: string;
      completionResult?: SignupCompletionResult | null;
    }
  ): Promise<SignupAttemptRow | null> {
    const set: Record<string, unknown> = {
      status,
      updated_at: new Date().toISOString(),
    };
    if (extra?.auth0VerifiedAt) set.auth0_verified_at = extra.auth0VerifiedAt;
    if (extra?.completedUserId) set.completed_user_id = extra.completedUserId;
    if (extra && 'completionResult' in extra) {
      set.completion_result = extra.completionResult;
    }
    const result = await this.hasura.executeMutation<{
      update_signup_attempts_by_pk: SignupAttemptRow | null;
    }>(
      `
      mutation UpdateSignupAttemptStatus(
        $id: uuid!
        $set: signup_attempts_set_input!
      ) {
        update_signup_attempts_by_pk(pk_columns: { id: $id }, _set: $set) {
          ${ATTEMPT_FIELDS}
        }
      }
    `,
      { id, set }
    );
    return result.update_signup_attempts_by_pk;
  }

  async claimForVerify(id: string): Promise<SignupAttemptRow | null> {
    const nowIso = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      update_signup_attempts: { returning: SignupAttemptRow[] };
    }>(
      `
      mutation ClaimSignupAttempt($id: uuid!, $now: timestamptz!) {
        update_signup_attempts(
          where: {
            id: { _eq: $id }
            status: { _in: ["pending", "verifying", "verified_pending_provision"] }
          }
          _set: { status: "verifying", updated_at: $now }
        ) {
          returning {
            ${ATTEMPT_FIELDS}
          }
        }
      }
    `,
      { id, now: nowIso }
    );
    return result.update_signup_attempts?.returning?.[0] ?? null;
  }

  async purgeExpired(): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.hasura.executeMutation<{
      delete_signup_attempts: { affected_rows: number };
    }>(
      `
      mutation PurgeExpiredSignupAttempts($now: timestamptz!) {
        delete_signup_attempts(where: { expires_at: { _lt: $now } }) {
          affected_rows
        }
      }
    `,
      { now: nowIso }
    );
    return result.delete_signup_attempts?.affected_rows ?? 0;
  }
}
