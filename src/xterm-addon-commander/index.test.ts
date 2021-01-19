import 'jest';
import { program } from '../commander-browserify';
import { CommanderAddon } from './';

describe('xterm-addon-commander', () => {
  it('_parseInputToArgv', () => {
    const commanderAddon = new CommanderAddon(program);
    expect(commanderAddon.parseInputToArgv('abc')).toEqual(['abc']);
    expect(commanderAddon.parseInputToArgv('abc bcd')).toEqual(['abc', 'bcd']);
    expect(commanderAddon.parseInputToArgv('abc bcd eft')).toEqual([
      'abc',
      'bcd',
      'eft',
    ]);
    expect(commanderAddon.parseInputToArgv('abc     e')).toEqual(['abc', 'e']);
    expect(commanderAddon.parseInputToArgv('abc ""abc')).toEqual([
      'abc',
      '',
      'abc',
    ]);
    expect(commanderAddon.parseInputToArgv('abc """abc')).toEqual([
      'abc',
      ``,
      'abc',
    ]);

    expect(commanderAddon.parseInputToArgv('abc "abc e"')).toEqual([
      'abc',
      'abc e',
    ]);
    expect(commanderAddon.parseInputToArgv(`abc 'abc e'`)).toEqual([
      'abc',
      'abc e',
    ]);
    expect(commanderAddon.parseInputToArgv(`abc 'abc e\'`)).toEqual([
      'abc',
      'abc e',
    ]);
  });
});
