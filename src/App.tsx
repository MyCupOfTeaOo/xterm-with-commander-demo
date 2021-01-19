import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { SearchAddon } from 'xterm-addon-search';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { FitAddon } from 'xterm-addon-fit';
import { program, Command } from 'commander-browserify';
import 'xterm/css/xterm.css';
import styles from './App.module.scss';
import { CommanderAddon } from 'xterm-addon-commander';
import { LoglevelAddon } from 'xterm-addon-loglevel';
import log from 'loglevel';

log.setLevel('DEBUG');

const brew = program.command('brew');
brew.command('tea').action(() => {
  log.info('brew tea');
});
brew.command('coffee').action(() => {
  log.error('brew coffee');
});

// Add nested commands using `.addCommand().
// The command could be created separately in another module.
function makeHeatCommand() {
  const heat = new Command('heat');
  heat.command('jug').action(() => {
    console.log('heat jug');
  });
  heat.command('pot').action(() => {
    console.log('heat pot');
  });
  return heat;
}
program.addCommand(makeHeatCommand());

function App() {
  const termRef = useRef<HTMLDivElement>(null);
  const logTermRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const term = new Terminal({
      cursorStyle: 'bar',
      cursorBlink: true,
    });
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon();
    const commanderAddon = new CommanderAddon(program);
    const fitAddon = new FitAddon();
    term.loadAddon(commanderAddon);
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.loadAddon(searchAddon);
    term.unicode.activeVersion = '11';
    term.open(termRef.current!);
    fitAddon.fit();
    term.write('\r\nhello please input your command \r\n');
    commanderAddon.prompt();

    const logTerm = new Terminal({
      cursorStyle: 'underline',
      cursorBlink: true,
      convertEol: true,
    });
    const logFitAddon = new FitAddon();

    const logLevelPlugin = new LoglevelAddon();
    logTerm.loadAddon(logLevelPlugin);
    logTerm.loadAddon(new Unicode11Addon());
    logTerm.loadAddon(new WebLinksAddon());
    logTerm.loadAddon(logFitAddon);
    logTerm.unicode.activeVersion = '11';
    logTerm.open(logTermRef.current!);
    logFitAddon.fit();

    return () => {
      term.dispose();
    };
  }, []);
  return (
    <div className={styles.App}>
      <header className={styles.AppHeader}>
        <div ref={termRef}></div>
        <div ref={logTermRef}></div>
      </header>
    </div>
  );
}

export default App;
