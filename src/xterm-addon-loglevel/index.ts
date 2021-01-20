import log, { LoggingMethod, MethodFactory } from 'loglevel';
import { ITerminalAddon, Terminal } from 'xterm';
import moment from 'moment';
import color from 'ansi-colors';

const pushMap: Record<string, Set<LoggingMethod>> = {};

const createMethodFactory: MethodFactory = (methodName, level, loggerName) => {
  const name = methodName.toUpperCase();
  if (!pushMap[name]) pushMap[name] = new Set<LoggingMethod>();
  return (...message) => {
    pushMap[name].forEach(push => push(loggerName, ...message));
  };
};

log.methodFactory = createMethodFactory;

log.setLevel(log.getLevel());

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
  private _terminal: Terminal | undefined;
  // private _loggerMethods: [string, LoggingMethod][] = [];
  private _loggerMethods: any[] = [];
  public colors: Record<string, (str: string) => string> = {
    ERROR: color.red,
    WARN: color.yellow,
    INFO: color.green,
    DEBUG: color.cyan,
  };

  public activate = (terminal: Terminal) => {
    this._terminal = terminal;
    Object.keys(pushMap).forEach(key => {
      const method = this._methodFactory(key);
      this._loggerMethods.push([key, method]);
      pushMap[key].add(method);
    });
  };

  public dispose(): void {
    this._loggerMethods.forEach(item => {
      pushMap[item[0]].delete(item[1]);
    });
  }

  private _methodFactory = (methodName: string): LoggingMethod => {
    const needStack = methodName.toUpperCase() === 'ERROR';
    const colorFunc = this.colors[methodName.toUpperCase()];
    return (loggerName: string | Symbol, ...message) => {
      const stacktrace = needStack ? getStacktrace() : undefined;
      let output = `[${moment().format(
        'YYYY-MM-DD hh:mm:ss',
      )}] ${methodName.toUpperCase()}${
        loggerName ? `(${loggerName.toString()})` : ''
      }: ${interpolate(message)}${stacktrace ? `\n${stacktrace}` : ''}`;
      if (colorFunc) {
        output = colorFunc(output);
      }
      this._terminal?.writeln(output);
      this._terminal?.scrollToBottom();
    };
  };
}
