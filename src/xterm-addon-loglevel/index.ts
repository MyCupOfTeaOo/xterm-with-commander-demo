import log, { MethodFactory } from 'loglevel';
import { IDisposable, ITerminalAddon, Terminal } from 'xterm';
import color from 'ansi-colors';

let CIRCULAR_ERROR_MESSAGE: any;

function tryStringify(arg: any) {
  try {
    return JSON.stringify(arg);
  } catch (error) {
    // Populate the circular error message lazily
    if (!CIRCULAR_ERROR_MESSAGE) {
      try {
        const a: any = {};
        a.a = a;
        JSON.stringify(a);
      } catch (circular) {
        CIRCULAR_ERROR_MESSAGE = circular.message;
      }
    }
    if (error.message === CIRCULAR_ERROR_MESSAGE) {
      return '[Circular]';
    }
    throw error;
  }
}

function getConstructorName(obj: any) {
  if (!Object.getOwnPropertyDescriptor || !Object.getPrototypeOf) {
    return Object.prototype.toString.call(obj).slice(8, -1);
  }

  // https://github.com/nodejs/node/blob/master/lib/internal/util.js
  while (obj) {
    const descriptor = Object.getOwnPropertyDescriptor(obj, 'constructor');
    if (
      descriptor !== undefined &&
      typeof descriptor.value === 'function' &&
      descriptor.value.name !== ''
    ) {
      return descriptor.value.name;
    }

    obj = Object.getPrototypeOf(obj);
  }

  return '';
}

function interpolate(array: any[]) {
  let result = '';
  let index = 0;

  if (array.length > 1 && typeof array[0] === 'string') {
    result = array[0].replace(
      /(%?)(%([sdjo]))/g,
      (match, escaped, ptn, flag) => {
        if (!escaped) {
          index += 1;
          const arg = array[index];
          let a = '';
          switch (flag) {
            case 's':
              a += arg;
              break;
            case 'd':
              a += +arg;
              break;
            case 'j':
              a = tryStringify(arg);
              break;
            case 'o': {
              let obj = tryStringify(arg);
              if (obj[0] !== '{' && obj[0] !== '[') {
                obj = `<${obj}>`;
              }
              a = getConstructorName(arg) + obj;
              break;
            }
          }
          return a;
        }
        return match;
      },
    );

    // update escaped %% values
    result = result.replace(/%{2,2}/g, '%');

    index += 1;
  }
  if (array.length > index) {
    if (result) result += ' ';
    result += array.slice(index).join(' ');
  }

  return result;
}

function getStacktrace() {
  try {
    throw new Error();
  } catch (trace) {
    return trace.stack;
  }
}

export class LoglevelAddon implements ITerminalAddon {
  private _disposables: IDisposable[] = [];
  private _terminal: Terminal | undefined;
  public colors: Record<string, (str: string) => string> = {
    ERROR: color.red,
    WARN: color.yellow,
    INFO: color.green,
    DEBUG: color.cyan,
  };

  constructor() {
    log.methodFactory = this._methodFactory;
    log.setLevel(log.getLevel());
  }

  public activate = (terminal: Terminal) => {
    this._terminal = terminal;
  };

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
  }

  private _methodFactory: MethodFactory = (methodName, level, loggerName) => {
    const needStack = methodName.toUpperCase() === 'ERROR';
    const colorFunc = this.colors[methodName.toUpperCase()];

    return (...message) => {
      const stacktrace = needStack ? getStacktrace() : undefined;
      let output = `[${new Date().toISOString()}] ${methodName.toUpperCase()}${String(
        loggerName || '',
      )}: ${interpolate(message)}${stacktrace ? `\n${stacktrace}` : ''}`;
      if (colorFunc) {
        output = colorFunc(output);
      }
      this._terminal?.writeln(output);
    };
  };
}
