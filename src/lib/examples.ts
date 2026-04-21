import type { CodeFormat } from './machine';

export interface Example {
  title: string;
  description: string;
  format: CodeFormat;
  code: string;
}

export const examples: Example[] = [
  {
    title: 'Session Timeout',
    description: 'Warn an inactive user, extend the session, or sign them out automatically',
    format: 'xstate',
    code: `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as
      | { type: 'USER_ACTIVITY' }
      | { type: 'EXTEND_SESSION' }
      | { type: 'DISMISS_WARNING' }
      | { type: 'SIGN_OUT' },
  },
}).createMachine({
  id: 'sessionTimeout',
  initial: 'active',
  states: {
    active: {
      after: {
        120000: {
          target: 'warning',
        },
      },
      on: {
        USER_ACTIVITY: {
          target: 'active',
        },
        SIGN_OUT: {
          target: 'signedOut',
        },
      },
    },
    warning: {
      after: {
        30000: {
          target: 'signedOut',
        },
      },
      on: {
        EXTEND_SESSION: {
          target: 'active',
        },
        DISMISS_WARNING: {
          target: 'active',
        },
        USER_ACTIVITY: {
          target: 'active',
        },
        SIGN_OUT: {
          target: 'signedOut',
        },
      },
    },
    signedOut: {
      type: 'final',
    },
  },
});`,
  },
  {
    title: 'OTP Verification',
    description: 'Handle code entry, resend cooldowns, expiration, and lockout after failed attempts',
    format: 'xstate',
    code: `import { setup, assign } from 'xstate';

const machine = setup({
  types: {
    context: {} as {
      attempts: number;
      resendCount: number;
    },
    events: {} as
      | { type: 'SUBMIT_CODE' }
      | { type: 'CODE_VALID' }
      | { type: 'CODE_INVALID' }
      | { type: 'RESEND_CODE' }
      | { type: 'EDIT_NUMBER' },
  },
}).createMachine({
  id: 'otpVerification',
  initial: 'enteringCode',
  context: {
    attempts: 0,
    resendCount: 0,
  },
  states: {
    enteringCode: {
      initial: 'ready',
      states: {
        ready: {
          after: {
            90000: {
              target: '#otpVerification.expired',
            },
          },
          on: {
            SUBMIT_CODE: {
              target: 'verifying',
            },
            RESEND_CODE: {
              target: 'cooldown',
              actions: assign({
                resendCount: ({ context }) => context.resendCount + 1,
              }),
            },
            EDIT_NUMBER: {
              target: '#otpVerification.editingNumber',
            },
          },
        },
        verifying: {
          on: {
            CODE_VALID: {
              target: '#otpVerification.verified',
            },
            CODE_INVALID: [
              {
                guard: ({ context }) => context.attempts >= 2,
                target: '#otpVerification.locked',
              },
              {
                target: 'ready',
                actions: assign({
                  attempts: ({ context }) => context.attempts + 1,
                }),
              },
            ],
          },
        },
        cooldown: {
          after: {
            30000: {
              target: 'ready',
            },
          },
        },
      },
    },
    editingNumber: {
      on: {
        RESEND_CODE: {
          target: 'enteringCode.cooldown',
        },
      },
    },
    verified: {
      type: 'final',
    },
    expired: {
      on: {
        RESEND_CODE: {
          target: 'enteringCode.cooldown',
        },
      },
    },
    locked: {
      on: {
        EDIT_NUMBER: {
          target: 'editingNumber',
        },
      },
    },
  },
});`,
  },
  {
    title: 'Checkout',
    description: 'Reserve inventory, process payment, and time out while waiting for confirmation',
    format: 'xstate',
    code: `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as
      | { type: 'SUBMIT_ORDER' }
      | { type: 'INVENTORY_RESERVED' }
      | { type: 'OUT_OF_STOCK' }
      | { type: 'PAYMENT_APPROVED' }
      | { type: 'PAYMENT_DECLINED' }
      | { type: 'RETRY_PAYMENT' }
      | { type: 'ORDER_CONFIRMED' }
      | { type: 'CANCEL' },
  },
}).createMachine({
  id: 'checkout',
  initial: 'reviewingCart',
  states: {
    reviewingCart: {
      on: {
        SUBMIT_ORDER: {
          target: 'reservingInventory',
        },
      },
    },
    reservingInventory: {
      after: {
        15000: {
          target: 'inventoryTimeout',
        },
      },
      on: {
        INVENTORY_RESERVED: {
          target: 'processingPayment',
        },
        OUT_OF_STOCK: {
          target: 'inventoryUnavailable',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    processingPayment: {
      after: {
        20000: {
          target: 'paymentTimeout',
        },
      },
      on: {
        PAYMENT_APPROVED: {
          target: 'awaitingConfirmation',
        },
        PAYMENT_DECLINED: {
          target: 'paymentFailed',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    awaitingConfirmation: {
      after: {
        10000: {
          target: 'confirmationDelayed',
        },
      },
      on: {
        ORDER_CONFIRMED: {
          target: 'completed',
        },
      },
    },
    paymentFailed: {
      on: {
        RETRY_PAYMENT: {
          target: 'processingPayment',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    inventoryUnavailable: {
      on: {
        SUBMIT_ORDER: {
          target: 'reservingInventory',
        },
      },
    },
    inventoryTimeout: {
      on: {
        SUBMIT_ORDER: {
          target: 'reservingInventory',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    paymentTimeout: {
      on: {
        RETRY_PAYMENT: {
          target: 'processingPayment',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    confirmationDelayed: {
      on: {
        ORDER_CONFIRMED: {
          target: 'completed',
        },
        CANCEL: {
          target: 'cancelled',
        },
      },
    },
    completed: {
      type: 'final',
    },
    cancelled: {
      type: 'final',
    },
  },
});`,
  },
  {
    title: 'Counter',
    description: 'Increment, decrement, change step size, and reset context with assign',
    format: 'xstate',
    code: `import { setup, assign } from 'xstate';

const machine = setup({
  types: {
    context: {} as {
      count: number;
      step: number;
    },
    events: {} as
      | { type: 'INC' }
      | { type: 'DEC' }
      | { type: 'STEP_5' }
      | { type: 'RESET' },
  },
}).createMachine({
  id: 'counter',
  initial: 'active',
  context: {
    count: 0,
    step: 1,
  },
  states: {
    active: {
      on: {
        INC: {
          actions: assign({
            count: ({ context }) => context.count + context.step,
          }),
        },
        DEC: {
          actions: assign({
            count: ({ context }) => context.count - context.step,
          }),
        },
        STEP_5: {
          actions: assign({
            step: 5,
          }),
        },
        RESET: {
          actions: assign({
            count: 0,
            step: 1,
          }),
        },
      },
    },
  },
});`,
  },
  {
    title: 'Traffic Light',
    description: 'Timed traffic light with nested red states for pedestrian crossing and turn arrows',
    format: 'xstate',
    code: `import { setup } from 'xstate';

const machine = setup({
  types: {
    events: {} as
      | { type: 'NEXT' }
      | { type: 'PEDESTRIAN_REQUEST' }
      | { type: 'EMERGENCY' }
      | { type: 'RESET' },
  },
}).createMachine({
  id: 'trafficLight',
  initial: 'green',
  states: {
    green: {
      after: { 5000: { target: 'yellow' } },
      on: {
        NEXT: { target: 'yellow' },
        EMERGENCY: { target: 'red.flash' },
      },
    },
    yellow: {
      after: { 2000: { target: 'red' } },
      on: {
        NEXT: { target: 'red' },
        EMERGENCY: { target: 'red.flash' },
      },
    },
    red: {
      initial: 'waiting',
      on: {
        EMERGENCY: { target: '.flash' },
      },
      states: {
        waiting: {
          on: {
            PEDESTRIAN_REQUEST: { target: 'pedestrianCrossing' },
          },
          after: { 3000: { target: 'turnArrow' } },
        },
        pedestrianCrossing: {
          after: { 4000: { target: 'turnArrow' } },
        },
        turnArrow: {
          after: { 3000: { target: 'clearance' } },
        },
        clearance: {
          after: { 1000: { target: '#trafficLight.green' } },
        },
        flash: {
          on: {
            RESET: { target: '#trafficLight.green' },
          },
        },
      },
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
        pointerup: {
          target: 'idle',
        },
        'keydown.escape': {
          target: 'idle',
        },
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
        PLAY: {
          target: 'playing',
        },
        LOAD: {
          target: 'loading',
        },
      },
    },
    loading: {
      on: {
        LOADED: {
          target: 'stopped',
        },
        ERROR: {
          target: 'error',
        },
      },
    },
    playing: {
      initial: 'buffering',
      on: {
        PAUSE: {
          target: 'paused',
        },
        END: {
          target: 'stopped',
        },
        ERROR: {
          target: 'error',
        },
      },
      states: {
        buffering: {
          on: { BUFFERED: { target: 'ready' } },
        },
        ready: {
          on: { NEED_BUFFER: { target: 'buffering' } },
        },
      },
    },
    paused: {
      on: {
        PLAY: {
          target: 'playing',
        },
        STOP: {
          target: 'stopped',
        },
      },
    },
    error: {
      on: {
        RETRY: {
          target: 'loading',
        },
        DISMISS: {
          target: 'stopped',
        },
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
        START: {
          target: 'running',
        },
        RESET: {
          target: 'stopped',
        },
      },
    },
    running: {
      on: {
        STOP: {
          target: 'paused',
        },
        LAP: {
          target: 'running',
        },
        RESET: {
          target: 'stopped',
        },
      },
    },
    paused: {
      on: {
        START: {
          target: 'running',
        },
        RESET: {
          target: 'stopped',
        },
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
