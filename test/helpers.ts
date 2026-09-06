import net from 'node:net';
import type { AddressInfo } from 'node:net';

/** Binds :0, reads the port the OS handed out, releases it. */
export const freePort = async (): Promise<number> => {
  const probe = net.createServer();
  await new Promise<void>(resolve => probe.listen(0, resolve));
  const { port } = probe.address() as AddressInfo;
  await new Promise<void>(resolve => probe.close(() => resolve()));
  return port;
};

/** Collects everything written to console.log while `run` is executing. */
export const captureLog = async (run: () => Promise<void>): Promise<string[]> => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };
  try {
    await run();
  } finally {
    console.log = original;
  }
  return lines;
};
