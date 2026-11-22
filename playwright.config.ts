import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: [
		{ command: 'node e2e/support/fake-mcp-server.ts', url: 'http://127.0.0.1:4180/' },
		{
			command: 'npm run build && npm run preview',
			port: 4173,
			// The fake MCP server runs on localhost over http, which production defaults block.
			env: { MCP_ALLOW_PRIVATE_HOSTS: 'true', MCP_ALLOW_INSECURE_HTTP: 'true' }
		}
	],
	testDir: 'e2e',
	use: { baseURL: 'http://localhost:4173' }
});
