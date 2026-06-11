# data-versioning Specification

## Purpose
Defines version resolution from `/api/versions.json`, the default-locale strategy, and mechanisms to override them.

## Requirements

### Requirement: Version Resolution
The system MUST resolve the current patch version at startup by fetching `https://ddragon.leagueoflegends.com/api/versions.json` and picking the first entry.

#### Scenario: Successful version resolution
- GIVEN the server starts
- WHEN it requests the version list
- THEN it MUST store the most recent patch version as the current resolved version
- AND use it as the default for subsequent requests

#### Scenario: Version fetch failure
- GIVEN Data Dragon is unreachable during startup
- WHEN the version request fails
- THEN the system MUST fall back to the last-known-good cached version
- AND fail fast if no cached version exists

### Requirement: Locale Strategy
The system MUST default to the `en_US` locale but MUST allow overrides via environment variables or explicit parameters.

#### Scenario: Default locale usage
- GIVEN no locale is explicitly provided via environment or request
- WHEN data is resolved
- THEN it MUST use the `en_US` locale

#### Scenario: Locale override via environment
- GIVEN the `LOL_DD_LOCALE` environment variable is set to `es_AR`
- WHEN data is resolved without an explicit request parameter
- THEN it MUST use the `es_AR` locale

### Requirement: Pin Version Override
The system MUST allow pinning a specific patch version via the `LOL_DD_PIN_VERSION` environment variable, bypassing version resolution.

#### Scenario: Pinned version active
- GIVEN `LOL_DD_PIN_VERSION` is set to "14.10.1"
- WHEN the system initializes
- THEN it MUST bypass fetching `/api/versions.json`
- AND strictly use "14.10.1" as the current version

#### Scenario: Pinned version missing from cache
- GIVEN `LOL_DD_PIN_VERSION` is set
- WHEN the system requests data for that version and it is not cached
- THEN it MUST fetch the data for the pinned version directly from Data Dragon