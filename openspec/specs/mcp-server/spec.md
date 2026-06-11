# mcp-server Specification

## Purpose
Defines the MCP server lifecycle, transport (stdio), startup behavior, error reporting, and tool registration for the pure data layer.

## Requirements

### Requirement: Server Initialization and Transport
The system MUST implement an MCP server using the `@modelcontextprotocol/sdk` over stdio transport.

#### Scenario: Successful startup
- GIVEN the server is started via the CLI
- WHEN the initialization process begins
- THEN it MUST connect over stdio
- AND expose server capabilities for tools

#### Scenario: Transport failure
- GIVEN the server is started in an invalid environment
- WHEN stdio is unavailable or bound
- THEN the server MUST exit with a non-zero status code

### Requirement: Strict Data-Only Boundary (Non-Reasoning)
The server MUST act as a pure data layer and MUST NOT include reasoning, tier lists, or recommendations in its implementation or exposed metadata.

#### Scenario: Enforcing boundary in tool response
- GIVEN a tool executes successfully
- WHEN the response is generated
- THEN the response MUST contain only structured game data
- AND MUST NOT contain AI-derived fields like `best`, `optimal`, `tier`, or `score`

#### Scenario: Enforcing boundary in tool registration
- GIVEN the server registers tools during startup
- WHEN the tool descriptions are passed to the MCP SDK
- THEN the descriptions MUST represent pure data access
- AND MUST NOT promise analysis or reasoning capabilities

### Requirement: Error Reporting Envelope
The system MUST return errors as typed payloads or `{ error: { code, message, hint } }` without throwing exceptions across the MCP protocol.

#### Scenario: Handled application error
- GIVEN a tool encounters a recoverable error (e.g., item not found)
- WHEN the error is caught
- THEN it MUST return an MCP-compliant error envelope
- AND MUST NOT crash the server process

#### Scenario: Unhandled runtime exception
- GIVEN an unexpected runtime error occurs during tool execution
- WHEN the error propagates to the transport layer
- THEN it MUST be caught and returned as a generic server error envelope
