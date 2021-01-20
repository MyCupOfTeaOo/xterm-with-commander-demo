import { Command } from 'commander-browserify';
import log from 'loglevel';
import { IDisposable, ITerminalAddon, Terminal } from 'xterm';

function addXterm(cmd: InstanceType<typeof Command>, xterm: Terminal) {
  cmd.xterm = xterm;
  cmd.commands.forEach(item => {
    addXterm(item, xterm);
  });
}

export class CommanderAddon implements ITerminalAddon {
  private _curLine: number = 0;
  private _entites: string[] = [];
  private _entityPos?: number;
  private _curInput: string = '';

  private _logger = log.getLogger('CommanderAddon');

  private _disposables: IDisposable[] = [];
  private _terminal: Terminal | undefined;
  private _commander: InstanceType<typeof Command>;

  private _shellprompt = '❯ ';

  constructor(commander: InstanceType<typeof Command>) {
    this._commander = commander;
  }

  public activate = (terminal: Terminal) => {
    this._terminal = terminal;
    addXterm(this._commander, terminal);
    this._disposables.push(terminal.onData(this._onData));
    this._disposables.push(terminal.onCursorMove(this._onCursorMove));
    this._disposables.push(terminal.onSelectionChange(this._onSelectionChange));
  };

  private _onData = (data: string) => {
    // 光标定位
    if (/(\u001b\[D){2,}|(\u001b\[C){2,}/g.test(data)) {
      this._terminal?.write(data);
      return;
    }
    switch (data) {
      case '\r': // Enter
      case '\u001b\r':
        this._executableCommand();
        break;
      case '\u0003': // Ctrl+C
        this.prompt();
        break;
      case '\b': // Backspace (DEL)
      case '\u007F': // Backspace (DEL)
        this._backspace();
        break;
      case '\u001b[A': // Arrow Up
      case '\u001b[1;2A':
      case '\u001b[1;3A':
      case '\u001b[1;4A':
      case '\u001b[1;5A':
      case '\u001b[1;6A':
      case '\u001b[1;7A':
      case '\u001b[1;8A':
        this._accessPrevEntity();
        break;
      case '\u001b[B': // Arrow Down
      case '\u001b[1;2B':
      case '\u001b[1;3B':
      case '\u001b[1;4B':
      case '\u001b[1;5B':
      case '\u001b[1;6B':
      case '\u001b[1;7B':
      case '\u001b[1;8B':
        this._accessNextEntity();
        break;
      case '\u001b[1;2D': // Arrow Left Select
        this._selectLeft();
        break;

      case '\u001b[D': // Arrow Left
      case '\u001b[1;3D':
      case '\u001b[1;4D':
      case '\u001b[1;5D':
      case '\u001b[1;6D':
      case '\u001b[1;7D':
      case '\u001b[1;8D':
        if (this._canArrowToLeft()) {
          this._terminal?.write(data);
        }
        break;
      case '\u001b[1;2C': // Arrow Right Select
        this._selectRight();
        break;
      case '\u001b[C': // Arrow Right
      case '\u001b[1;3C':
      case '\u001b[1;4C':
      case '\u001b[1;5C':
      case '\u001b[1;6C':
      case '\u001b[1;7C':
      case '\u001b[1;8C':
        if (this._canArrowToRight()) {
          this._terminal?.write(data);
        }
        break;
      case '\u001b[H': // home
      case '\u001b[1;2H':
      case '\u001b[1;3H':
      case '\u001b[1;4H':
      case '\u001b[1;5H':
      case '\u001b[1;6H':
      case '\u001b[1;7H':
      case '\u001b[1;8H':
        this._toHome();
        break;
      case '\u001b[F': // end
      case '\u001b[1;2F':
      case '\u001b[1;3F':
      case '\u001b[1;4F':
      case '\u001b[1;5F':
      case '\u001b[1;6F':
      case '\u001b[1;7F':
      case '\u001b[1;8F':
        this._toEnd();
        break;
      default:
        // Print
        this._input(data);
    }
  };

  public prompt = () => {
    this._terminal?.write('\r\n' + this._shellprompt);

    this._curLine =
      (this._terminal?.buffer.active.cursorY || this._curLine) + 1;
    this._curInput = '';
    this._entityPos = undefined;
  };

  private _backspace = () => {
    if (this._canArrowToLeft()) {
      const pos =
        (this._terminal?.buffer.active.cursorX || 0) - this._shellprompt.length;
      const prefix = this._curInput.slice(0, pos - 1);
      const suffix = this._curInput.slice(pos, this._curInput.length);
      this._curInput = prefix + suffix;

      this._terminal?.write(
        '\b' +
          suffix +
          ' ' +
          [...Array(this._curInput.length - pos + 2)].map(() => '\b').join(''),
      );
    }
  };

  private _canArrowToLeft = () => {
    if (this._terminal) {
      return (
        (this._terminal.buffer.active.cursorX || 0) > this._shellprompt.length
      );
    }
    return false;
  };

  private _canArrowToRight = () => {
    if (this._terminal) {
      return (
        (this._terminal.buffer.active.cursorX || 0) <
        (this._curInput?.length || 0) + this._shellprompt.length
      );
    }
    return false;
  };

  private _accessPrevEntity = () => {
    if (this._entityPos === undefined) {
      this._entityPos = this._entites.length - 1;
    } else if (this._entityPos > 0) {
      this._entityPos = Math.max(this._entityPos - 1, 0);
    } else {
      return;
    }
    const entity = this._entites[this._entityPos];
    if (entity) {
      this._overLine(entity);
    }
  };

  private _accessNextEntity = () => {
    if (
      this._entityPos !== undefined &&
      this._entityPos < this._entites.length - 1
    ) {
      this._entityPos = this._entityPos + 1;
      const entity = this._entites[this._entityPos];
      if (entity) {
        this._overLine(entity);
      }
    }
  };

  private _overLine = (data: string) => {
    const len =
      (this._terminal?.buffer.active.cursorX || 0) - this._shellprompt.length;
    // 光标移动到最前端然后输出空格覆盖到最后段,在回退到最前端,在输出值
    this._terminal?.write(
      [...Array(len)].map(() => '\b').join('') +
        [...Array(this._curInput.length)].map(() => ' ').join('') +
        [...Array(this._curInput.length)].map(() => '\b').join('') +
        data,
    );
    this._curInput = data;
  };

  private _toHome = () => {
    const len =
      (this._terminal?.buffer.active.cursorX || 0) - this._shellprompt.length;
    if (len > 0) {
      this._terminal?.write([...Array(len)].map(() => '\b').join(''));
    } else {
      this._terminal?.write([...Array(-len)].map(() => '\u001b[C').join(''));
    }
  };

  private _toEnd = () => {
    const len =
      this._curInput.length -
      ((this._terminal?.buffer.active.cursorX || 0) - this._shellprompt.length);

    if (len > 0) {
      this._terminal?.write([...Array(len)].map(() => '\u001b[C').join(''));
    } else {
      this._terminal?.write([...Array(-len)].map(() => '\b').join(''));
    }
  };
  private _selectLeft = () => {
    // const pos = this._terminal?.getSelectionPosition();
    // const prevX = this._terminal?.buffer.active.cursorX || 0;
    // const nextX = Math.max(this._shellprompt.length - 1, prevX - 1);
    // const end = pos?.endColumn || prevX;
    this._terminal?.write('\u001b[D');
    // this._terminal?.select(nextX, this._curLine, end - nextX);
  };

  private _selectRight = () => {
    this._terminal?.write('\u001b[C');
  };

  private _onCursorMove = () => {
    if ((this._terminal?.buffer.active.cursorX || 0) < 2) {
      this._toHome();
    }
    if (
      (this._terminal?.buffer.active.cursorX || 0) >
      this._curInput.length + this._shellprompt.length
    ) {
      this._toEnd();
    }
  };

  private _onSelectionChange = () => {};

  private _input = (data: string) => {
    const x =
      (this._terminal?.buffer.active.cursorX || 0) - this._shellprompt.length;

    if (x < this._curInput.length) {
      const suffix = this._curInput.slice(x);
      this._curInput = this._curInput.slice(0, x) + data + suffix;
      this._terminal?.write(data + suffix);
      this._terminal?.write([...Array(suffix.length)].map(() => '\b').join(''));
    } else {
      this._curInput += data;
      this._terminal?.write(data);
    }
  };

  public parseInputToArgv = (input: string): string[] => {
    return parseArgsStringToArgv(input);
  };

  private _executableCommand = () => {
    if (this._curInput) {
      this._entites.push(this._curInput);
      const argv = this.parseInputToArgv(this._curInput);
      try {
        this._logger.debug('尝试执行命令: ', argv.join(' '));
        this._commander.parse(argv);
      } catch (error) {
        if (error.message !== '0') {
          if (error.message === '1') {
            this._logger.warn(
              '命令识别失败退出: ',
              argv.join(' '),
              '\n',
              'exitcode',
              error.message,
            );
          } else {
            this._logger.error(
              '执行命令异常: ',
              argv.join(' '),
              '\n',
              error.message,
            );
          }
        }
      }
    }
    this.prompt();
  };

  public dispose(): void {
    this._disposables.forEach(d => d.dispose());
  }
}

function parseArgsStringToArgv(
  value: string,
  env?: string,
  file?: string,
): string[] {
  // ([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*) Matches nested quotes until the first space outside of quotes

  // [^\s'"]+ or Match if not a space ' or "

  // (['"])([^\5]*?)\5 or Match "quoted text" without quotes
  // `\3` and `\5` are a backreference to the quote style (' or ") captured
  const myRegexp = /([^\s'"]([^\s'"]*(['"])([^\3]*?)\3)+[^\s'"]*)|[^\s'"]+|(['"])([^\5]*?)\5/gi;
  const myString = value;
  const myArray: string[] = [];
  if (env) {
    myArray.push(env);
  }
  if (file) {
    myArray.push(file);
  }
  let match: RegExpExecArray | null;
  do {
    // Each call to exec returns the next regex match as an array
    match = myRegexp.exec(myString);
    if (match !== null) {
      // Index 1 in the array is the captured group if it exists
      // Index 0 is the matched text, which we use if no captured group exists
      myArray.push(firstString(match[1], match[6], match[0])!);
    }
  } while (match !== null);

  return myArray;
}

// Accepts any number of arguments, and returns the first one that is a string
// (even an empty string)
function firstString(...args: Array<any>): string | undefined {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (typeof arg === 'string') {
      return arg;
    }
  }
}
