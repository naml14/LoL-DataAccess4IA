# data-dragon-client Specification

## Purpose
Defines the HTTP client for connecting to `ddragon.leagueoflegends.com`, handling requests, retries, and graceful degradation.

## Requirements

### Requirement: HTTP Request and Resilience
The client MUST fetch data from Data Dragon over HTTPS with a configurable timeout and retry mechanism.

#### Scenario: Successful fetch
- GIVEN a valid URL path to a Data Dragon resource
- WHEN the client requests the data
- THEN it MUST return the parsed JSON payload
- AND respect the HTTP 200 OK status

#### Scenario: Retry on transient failure
- GIVEN the Riot API returns a 503 Service Unavailable or network times out
- WHEN the client attempts the request
- THEN it MUST retry the request up to a maximum limit before failing
- AND use exponential backoff or similar delay

### Requirement: Graceful Failure Handling
The client MUST fail gracefully when Data Dragon is persistently unreachable or returns 4xx client errors.

#### Scenario: Persistent server failure (5xx)
- GIVEN the Riot API is persistently down
- WHEN the retry limit is exhausted
- THEN the client MUST return a structured network error indicating the upstream failure

#### Scenario: Resource not found (404)
- GIVEN a request for a non-existent resource (e.g., an invalid patch version)
- WHEN the Riot API returns a 404 Not Found
- THEN the client MUST return a typed "Not Found" error immediately without retrying

### Requirement: Strict Timeout Enforcement
The client MUST enforce a strict timeout for all HTTP requests to prevent the server from hanging indefinitely.

#### Scenario: Request completes within timeout
- GIVEN a standard request to a healthy endpoint
- WHEN the request duration is less than the timeout limit
- THEN it MUST return the payload normally

#### Scenario: Request exceeds timeout
- GIVEN a slow network or unresponsive Data Dragon server
- WHEN the request duration exceeds the configured timeout
- THEN the client MUST abort the request
- AND return a timeout error envelope