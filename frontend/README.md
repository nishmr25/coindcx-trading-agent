# CoinDCX Trading Agent

This workspace now contains a Vite React app built from the original `Coindcx trading agent · JSX` source.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
3. Open the app in your browser:
   ```
   http://localhost:5173
   ```

## Build for production

```bash
npm run build
```

## Notes

- The original source file is still available as `Coindcx trading agent · JSX`.
- The React entrypoint is `src/App.jsx`.
- The app uses Vite, React, and the CoinDCX API via browser fetch.
- Live trading requires valid CoinDCX API credentials.

## MCP configuration

This workspace includes a project-scoped MCP config file at `.mcp.json`.

The file defines a placeholder MCP server named `coindcx`:

```json
{
  "mcpServers": {
    "coindcx": {
      "type": "http",
      "url": "http://localhost:4000/mcp",
      "headers": {
        "Authorization": "Bearer REPLACE_WITH_YOUR_MCP_TOKEN"
      }
    }
  }
}
```

Replace the `url` and `Authorization` values with your own running MCP provider endpoint. CoinDCX itself is not an MCP server; this config assumes a local or remote MCP-compatible proxy/service that implements the MCP transport protocol and forwards requests to CoinDCX.
