import { describe, expect, test } from "bun:test";
import {
  getChampionPath,
  getChampionDetailPath,
  getItemListPath,
  getRuneListPath,
  getSummonerSpellsPath,
  getProfileIconPath,
  getVersionsPath,
} from "../../src/ddragon/endpoints";

describe("ddragon endpoints", () => {
  describe("getChampionPath", () => {
    test("returns canonical champion list URL", () => {
      const url = getChampionPath("14.10.1", "en_US");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/champion.json"
      );
    });

    test("locale is substituted into URL", () => {
      const url = getChampionPath("14.1.1", "es_AR");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.1.1/data/es_AR/champion.json"
      );
    });
  });

  describe("getChampionDetailPath", () => {
    test("returns champion detail URL for given champion id", () => {
      const url = getChampionDetailPath("14.10.1", "en_US", "Ahri");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/champion/Ahri.json"
      );
    });

    test("locale is substituted", () => {
      const url = getChampionDetailPath("13.16.3", "ko_KR", "Yasuo");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/13.16.3/data/ko_KR/champion/Yasuo.json"
      );
    });
  });

  describe("getItemListPath", () => {
    test("returns canonical item list URL", () => {
      const url = getItemListPath("14.10.1", "en_US");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/item.json"
      );
    });
  });

  describe("getRuneListPath", () => {
    test("returns canonical rune list URL", () => {
      const url = getRuneListPath("14.10.1", "en_US");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/runesReforged.json"
      );
    });
  });

  describe("getSummonerSpellsPath", () => {
    test("returns canonical summoner spells URL", () => {
      const url = getSummonerSpellsPath("14.10.1", "en_US");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/summoner.json"
      );
    });
  });

  describe("getProfileIconPath", () => {
    test("returns canonical profile icon URL", () => {
      const url = getProfileIconPath("14.10.1", "en_US");
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/cdn/14.10.1/data/en_US/profileicon.json"
      );
    });
  });

  describe("getVersionsPath", () => {
    test("returns versions endpoint URL", () => {
      const url = getVersionsPath();
      expect(url).toBe(
        "https://ddragon.leagueoflegends.com/api/versions.json"
      );
    });
  });
});