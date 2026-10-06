/**
 * Drives the Renda character in the assistant chat (empty-state hero + header
 * avatar) from AssistantStore signals and the composer. The rules live in the
 * pure `utils/assistantCharacterMachine.ts`; this store only wires MobX
 * reactions and one wake-up timer.
 */
import { makeAutoObservable, reaction, type IReactionDisposer } from 'mobx';
import {
  chatCharacterNextWakeAt,
  chatCharacterState,
  initialChatCharacterMachine,
  reduceChatCharacter,
  type ChatCharacterEvent,
  type ChatCharacterMachine,
  type ChatCharacterState,
} from '../utils/assistantCharacterMachine';
import type { AssistantSettle } from './AssistantStore';

/** The AssistantStore slice this store depends on. */
export type AssistantCharacterSource = {
  isSending: boolean;
  threadId: string;
  lastSettle: AssistantSettle | null;
};

export type CharacterClock = {
  now: () => number;
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
};

const defaultClock: CharacterClock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
};

export class AssistantCharacterStore {
  state: ChatCharacterState = 'idle';
  private machine: ChatCharacterMachine = initialChatCharacterMachine;
  private timer: unknown = null;
  private readonly disposers: IReactionDisposer[] = [];

  constructor(
    source: AssistantCharacterSource,
    private readonly clock: CharacterClock = defaultClock
  ) {
    makeAutoObservable<AssistantCharacterStore, 'machine' | 'timer' | 'disposers' | 'clock'>(
      this,
      { machine: false, timer: false, disposers: false, clock: false },
      { autoBind: true }
    );
    this.disposers.push(
      reaction(
        () => source.isSending,
        (sending) => {
          if (sending) this.dispatch({ type: 'send' });
        }
      ),
      reaction(
        () => source.lastSettle,
        (settle) => {
          if (settle) {
            this.dispatch({ type: 'settled', outcome: settle.outcome, toolSuccess: settle.toolSuccess });
          }
        }
      ),
      reaction(
        () => source.threadId,
        () => this.dispatch({ type: 'reset' })
      )
    );
  }

  /** Composer focus + content, from the chat screen. */
  setComposer(focused: boolean, nonEmpty: boolean): void {
    if (this.machine.composerFocused === focused && this.machine.composerNonEmpty === nonEmpty) return;
    this.dispatch({ type: 'composer', focused, nonEmpty });
  }

  dispatch(event: ChatCharacterEvent): void {
    const now = this.clock.now();
    this.machine = reduceChatCharacter(this.machine, event, now);
    this.sync(now);
  }

  private sync(now: number): void {
    this.state = chatCharacterState(this.machine, now);
    if (this.timer !== null) {
      this.clock.clearTimeout(this.timer);
      this.timer = null;
    }
    const wakeAt = chatCharacterNextWakeAt(this.machine, now);
    if (wakeAt !== null) {
      this.timer = this.clock.setTimeout(() => {
        this.timer = null;
        this.dispatch({ type: 'tick' });
      }, Math.max(0, wakeAt - now));
    }
  }

  dispose(): void {
    this.disposers.forEach((d) => d());
    if (this.timer !== null) this.clock.clearTimeout(this.timer);
    this.timer = null;
  }
}
