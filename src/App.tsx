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

const brew = program.command('brew');
brew.command('tea').action(() => {
  console.log('brew tea');
});
brew.command('coffee').action(() => {
  console.log('brew coffee');
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
  useEffect(() => {
    const term = new Terminal({
      cursorStyle: 'bar',
      cursorBlink: true,
      windowsMode: true,
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
    return () => {
      term.dispose();
    };
  }, []);
  return (
    <div className={styles.App}>
      <header className={styles.AppHeader}>
        <div ref={termRef}></div>
      </header>
    </div>
  );
}

export default App;
