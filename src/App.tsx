import React, { useEffect, useRef } from 'react';
import { Terminal } from 'xterm';
import { SearchAddon } from 'xterm-addon-search';
import { Unicode11Addon } from 'xterm-addon-unicode11';
import { WebLinksAddon } from 'xterm-addon-web-links';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import styles from './App.module.scss';
import { CommanderAddon } from 'xterm-addon-commander';

function App() {
  const termRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const term = new Terminal({
      cursorStyle: 'bar',
      cursorBlink: true,
    });
    const searchAddon = new SearchAddon();
    const unicode11Addon = new Unicode11Addon();
    const webLinksAddon = new WebLinksAddon();
    const commanderAddon = new CommanderAddon();
    const fitAddon = new FitAddon();
    term.loadAddon(commanderAddon);
    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);
    term.loadAddon(unicode11Addon);
    term.loadAddon(searchAddon);
    term.unicode.activeVersion = '11';
    term.open(termRef.current!);
    fitAddon.fit();
    term.writeln('hello world!');
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
