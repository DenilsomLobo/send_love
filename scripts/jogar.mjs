import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const noOpen = process.argv.includes('--no-open');

function openBrowser(url) {
  if (noOpen) return;
  const command = process.platform === 'win32' ? 'rundll32.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['url.dll,FileProtocolHandler', url] : [url];
  const child = spawn(command, args, { detached: true, stdio: 'ignore', windowsHide: true });
  child.on('error', () => console.log(`Abra este endereco no navegador: ${url}`));
  child.unref();
}

async function runningGame(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(650) });
    if (!response.ok) return false;
    const html = await response.text();
    return html.includes('<title>Send Love') && html.includes('id="keyboard-dialog"');
  } catch { return false; }
}

try {
  console.log('\nSend Love - Correio da floresta\n');
  let existing = false;
  for (let port = 5174; port <= 5184; port++) {
    if (!await runningGame(port)) continue;
    const url = `http://127.0.0.1:${port}/`;
    console.log(`O jogo ja esta rodando. Abrindo ${url}`);
    openBrowser(url); existing = true; break;
  }
  if (!existing) {
    const { createServer } = await import('vite');
    const server = await createServer({ root, server: { host: '0.0.0.0', port: 5174, strictPort: false } });
    await server.listen();
    const port = server.httpServer.address().port;
    console.log('Mantenha esta janela aberta enquanto joga. Para encerrar, pressione Ctrl+C.\n');
    server.printUrls();
    openBrowser(`http://127.0.0.1:${port}/`);
    let closing = false;
    const stop = async () => { if (closing) return; closing = true; await server.close(); process.exit(0); };
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
  }
} catch (error) {
  console.error(`Falha ao iniciar: ${error.message}`);
  process.exitCode = 1;
}
