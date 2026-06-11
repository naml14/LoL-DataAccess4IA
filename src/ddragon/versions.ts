import { loadConfig } from "../config";
import { getVersionsPath } from "./endpoints";

export interface VersionInfo {
  current: string;
  all: string[];
}

/**
 * Fetch and resolve the current live Data Dragon version.
 *
 * @param pinnedVersion - Optional override; when provided the network request is
 *   skipped entirely and this version is returned. Useful for testing and for
 *   the internal pin path.
 */
export async function resolveVersion(pinnedVersion?: string): Promise<VersionInfo> {
  const pin = pinnedVersion ?? loadConfig().pinVersion;

  if (pin !== null) {
    return { current: pin, all: [pin] };
  }

  try {
    const versions = await getVersions();
    if (versions.length === 0) {
      throw new Error("Data Dragon returned an empty versions list");
    }
    return { current: versions[0], all: versions };
  } catch (err) {
    if (err instanceof TypeError && err.message === "Failed to fetch") {
      throw new Error("Failed to fetch from Data Dragon");
    }
    throw err;
  }
}

/**
 * Fetch the full versions array from Data Dragon.
 */
export async function getVersions(): Promise<string[]> {
  const url = getVersionsPath();
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(
      `Data Dragon returned error ${res.status} for ${url}`
    );
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error(`Expected versions.json to return an array, got ${typeof data}`);
  }
  return data as string[];
}