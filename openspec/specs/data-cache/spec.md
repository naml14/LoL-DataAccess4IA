# data-cache Specification

## Purpose
Defines the disk and memory cache layers, TTL (Time-To-Live), version-aware invalidation, and retention policies.

## Requirements

### Requirement: Two-Tier Caching
The system MUST cache Data Dragon payloads in-memory and on disk under the directory specified by `LOL_DD_CACHE_DIR` (or a system temp default).

#### Scenario: Cache miss
- GIVEN data is not in memory or on disk
- WHEN data is requested for a specific `(version, locale, path)`
- THEN it MUST fetch from upstream
- AND store the payload to disk
- AND store the payload in memory

#### Scenario: Disk cache hit
- GIVEN data is expired or absent in memory but exists on disk
- WHEN data is requested
- THEN it MUST read from disk, parse it, and populate the memory cache

### Requirement: Cache TTL and Invalidation
The system MUST respect a TTL (default 15 minutes, configurable via `LOL_DD_TTL_SECONDS`) for version resolution and active cache polling.

#### Scenario: TTL expiry for version check
- GIVEN the cached `versions.json` is older than the configured TTL
- WHEN a new request arrives that relies on the current version
- THEN the system MUST fetch fresh version data from Data Dragon

#### Scenario: Explicit version bypasses TTL
- GIVEN a tool explicitly requests an older patch version (e.g., "13.1.1")
- WHEN the system checks the cache
- THEN it MUST return the cached data for that version
- AND ignore the TTL check since old versions are immutable

### Requirement: Cache Retention Policy
The disk cache MUST retain a maximum of 3 recent patch versions and evict older versions to prevent unbounded disk usage.

#### Scenario: Version limit not reached
- GIVEN the disk cache contains data for 2 patch versions
- WHEN data for a 3rd version is downloaded
- THEN the cache MUST retain data for all 3 versions

#### Scenario: Version limit exceeded
- GIVEN the disk cache contains data for 3 patch versions
- WHEN data for a 4th version is downloaded
- THEN the cache MUST delete the files associated with the oldest stored version
