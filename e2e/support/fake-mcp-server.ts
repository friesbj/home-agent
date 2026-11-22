// Starts the fake Home Assistant MCP server for Playwright (run directly with Node's type stripping).
import { startFakeHaMcpServer } from '../../src/lib/server/mcp/fake-ha-mcp-server.ts';

const server = await startFakeHaMcpServer(Number(process.env.FAKE_MCP_PORT ?? 4180));
console.log(`Fake MCP server listening on ${server.url}`);
