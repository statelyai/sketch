import type { CodeFormat } from './machine';

export interface Example {
  title: string;
  description: string;
  format: CodeFormat;
  code: string;
}

export const examples: Example[] = [
  {
    title: 'Traffic Light',
    description: 'A simple traffic light with timed transitions',
    format: 'xstate',
    code: `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as { type: 'NEXT' },
  },
}).createMachine({
  id: 'trafficLight',
  initial: 'green',
  states: {
    green: {
      after: { 3000: 'yellow' },
      on: { NEXT: 'yellow' },
    },
    yellow: {
      after: { 1000: 'red' },
      on: { NEXT: 'red' },
    },
    red: {
      after: { 4000: 'green' },
      on: { NEXT: 'green' },
    },
  },
});`,
  },
  {
    title: 'Vending Machine',
    description: 'Insert coins, pick a snack, collect it',
    format: 'json',
    code: JSON.stringify(
      {
        id: 'vendingMachine',
        initial: 'idle',
        states: {
          idle: {
            on: { INSERT_COIN: 'hasCredit' },
          },
          hasCredit: {
            on: {
              INSERT_COIN: 'hasCredit',
              SELECT_SNACK: 'dispensing',
              PRESS_RETURN: 'returningChange',
            },
          },
          dispensing: {
            on: { SNACK_DROPPED: 'collect' },
          },
          collect: {
            on: { TAKE_SNACK: 'idle' },
          },
          returningChange: {
            on: { COINS_RETURNED: 'idle' },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    title: 'Drag & Drop',
    description: 'Mouse-driven drag and drop interaction',
    format: 'xstate',
    code: `import { setup, assign } from 'xstate';

const machine = setup({
  types: {
    context: {} as {
      x: number;
      y: number;
      dx: number;
      dy: number;
    },
    events: {} as
      | { type: 'pointerdown'; x: number; y: number }
      | { type: 'pointermove'; x: number; y: number }
      | { type: 'pointerup' }
      | { type: 'keydown.escape' },
  },
}).createMachine({
  id: 'drag',
  initial: 'idle',
  context: { x: 0, y: 0, dx: 0, dy: 0 },
  states: {
    idle: {
      on: {
        pointerdown: {
          target: 'dragging',
          actions: assign({
            dx: ({ event }) => event.x,
            dy: ({ event }) => event.y,
          }),
        },
      },
    },
    dragging: {
      on: {
        pointermove: {
          actions: assign({
            x: ({ context, event }) => context.x + event.x - context.dx,
            y: ({ context, event }) => context.y + event.y - context.dy,
            dx: ({ event }) => event.x,
            dy: ({ event }) => event.y,
          }),
        },
        pointerup: 'idle',
        'keydown.escape': 'idle',
      },
    },
  },
});`,
  },
  {
    title: 'Authentication',
    description: 'Login flow with retry and lockout',
    format: 'json',
    code: JSON.stringify(
      {
        id: 'auth',
        initial: 'loggedOut',
        states: {
          loggedOut: {
            initial: 'idle',
            states: {
              idle: {
                on: { SUBMIT: 'authenticating' },
              },
              authenticating: {
                on: {
                  SUCCESS: '#auth.loggedIn',
                  FAILURE: 'error',
                },
              },
              error: {
                on: {
                  SUBMIT: 'authenticating',
                  FORGOT: '#auth.forgotPassword',
                },
              },
            },
          },
          loggedIn: {
            on: { LOGOUT: 'loggedOut' },
          },
          forgotPassword: {
            initial: 'form',
            states: {
              form: {
                on: { SUBMIT: 'sending' },
              },
              sending: {
                on: {
                  SUCCESS: 'sent',
                  FAILURE: 'form',
                },
              },
              sent: {
                on: { BACK: '#auth.loggedOut' },
              },
            },
          },
        },
      },
      null,
      2,
    ),
  },
  {
    title: 'Media Player',
    description: 'Play, pause, and track progress',
    format: 'xstate',
    code: `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as
      | { type: 'PLAY' }
      | { type: 'PAUSE' }
      | { type: 'STOP' }
      | { type: 'LOAD' }
      | { type: 'LOADED' }
      | { type: 'END' }
      | { type: 'ERROR' }
      | { type: 'RETRY' }
      | { type: 'DISMISS' }
      | { type: 'BUFFERED' }
      | { type: 'NEED_BUFFER' },
  },
}).createMachine({
  id: 'mediaPlayer',
  initial: 'stopped',
  states: {
    stopped: {
      on: {
        PLAY: 'playing',
        LOAD: 'loading',
      },
    },
    loading: {
      on: {
        LOADED: 'stopped',
        ERROR: 'error',
      },
    },
    playing: {
      initial: 'buffering',
      on: {
        PAUSE: 'paused',
        END: 'stopped',
        ERROR: 'error',
      },
      states: {
        buffering: {
          on: { BUFFERED: 'ready' },
        },
        ready: {
          on: { NEED_BUFFER: 'buffering' },
        },
      },
    },
    paused: {
      on: {
        PLAY: 'playing',
        STOP: 'stopped',
      },
    },
    error: {
      on: {
        RETRY: 'loading',
        DISMISS: 'stopped',
      },
    },
  },
});`,
  },
  {
    title: 'Promise',
    description: 'The classic pending / resolved / rejected',
    format: 'yaml',
    code: `id: promise
initial: pending
states:
  pending:
    on:
      RESOLVE: resolved
      REJECT: rejected
  resolved:
    type: final
  rejected:
    on:
      RETRY: pending`,
  },
  {
    title: 'Stopwatch',
    description: 'Start, stop, lap, and reset',
    format: 'xstate',
    code: `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as
      | { type: 'START' }
      | { type: 'STOP' }
      | { type: 'LAP' }
      | { type: 'RESET' },
  },
}).createMachine({
  id: 'stopwatch',
  initial: 'stopped',
  states: {
    stopped: {
      on: {
        START: 'running',
        RESET: 'stopped',
      },
    },
    running: {
      on: {
        STOP: 'paused',
        LAP: 'running',
        RESET: 'stopped',
      },
    },
    paused: {
      on: {
        START: 'running',
        RESET: 'stopped',
      },
    },
  },
});`,
  },
  {
    title: 'Elevator',
    description: 'Multi-floor elevator with door logic',
    format: 'yaml',
    code: `id: elevator
initial: idle
states:
  idle:
    on:
      CALL: moving
  moving:
    on:
      ARRIVED: doorOpening
      EMERGENCY_STOP: emergency
  doorOpening:
    on:
      FULLY_OPEN: doorOpen
  doorOpen:
    on:
      TIMER_EXPIRED: doorClosing
      OBSTRUCTION: doorOpen
      CALL: doorClosing
  doorClosing:
    on:
      FULLY_CLOSED: idle
      OBSTRUCTION: doorOpening
  emergency:
    on:
      RESET: idle`,
  },
  {
    title: 'Form Wizard',
    description: 'Multi-step form with validation',
    format: 'json',
    code: JSON.stringify(
      {
        id: 'wizard',
        initial: 'personalInfo',
        states: {
          personalInfo: {
            initial: 'editing',
            states: {
              editing: {
                on: { VALIDATE: 'validating' },
              },
              validating: {
                on: {
                  VALID: '#wizard.address',
                  INVALID: 'editing',
                },
              },
            },
          },
          address: {
            initial: 'editing',
            states: {
              editing: {
                on: {
                  VALIDATE: 'validating',
                  BACK: '#wizard.personalInfo',
                },
              },
              validating: {
                on: {
                  VALID: '#wizard.review',
                  INVALID: 'editing',
                },
              },
            },
          },
          review: {
            on: {
              SUBMIT: 'submitting',
              BACK: 'address',
            },
          },
          submitting: {
            on: {
              SUCCESS: 'complete',
              ERROR: 'review',
            },
          },
          complete: {
            type: 'final',
          },
        },
      },
      null,
      2,
    ),
  },
  {
    title: 'Coffee Machine',
    description: 'Brew selection, grinding, and brewing',
    format: 'yaml',
    code: `id: coffeeMachine
initial: idle
states:
  idle:
    on:
      SELECT_ESPRESSO: grinding
      SELECT_LATTE: grinding
      SELECT_CAPPUCCINO: grinding
  grinding:
    after:
      2000: brewing
  brewing:
    after:
      5000: ready
  ready:
    on:
      TAKE_CUP: idle
      TIMEOUT: cleaning
  cleaning:
    after:
      3000: idle`,
  },
  {
    title: 'Door Lock',
    description: 'Lock, unlock, and open a door',
    format: 'mermaid',
    code: `stateDiagram-v2
    [*] --> Locked
    Locked --> Unlocked : UNLOCK
    Unlocked --> Locked : LOCK
    Unlocked --> Open : OPEN
    Open --> Unlocked : CLOSE`,
  },
  {
    title: 'Order Process',
    description: 'Order lifecycle from placement to delivery',
    format: 'mermaid',
    code: `flowchart TD
    Pending -->|CONFIRM| Processing
    Processing -->|SHIP| Shipped
    Shipped -->|DELIVER| Delivered
    Pending -->|CANCEL| Cancelled
    Processing -->|CANCEL| Cancelled`,
  },
  {
    title: 'Connection',
    description: 'Network connection with reconnect logic',
    format: 'mermaid',
    code: `stateDiagram-v2
    [*] --> Disconnected
    Disconnected --> Connecting : CONNECT
    Connecting --> Connected : SUCCESS
    Connecting --> Disconnected : FAILURE
    Connected --> Disconnecting : DISCONNECT
    Disconnecting --> Disconnected : DONE
    Connected --> Reconnecting : LOST
    Reconnecting --> Connected : SUCCESS
    Reconnecting --> Disconnected : FAILURE`,
  },
];
