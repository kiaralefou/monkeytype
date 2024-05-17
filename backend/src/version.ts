import { join } from "path";
import { isDevEnvironment, padNumbers } from "./utils/misc";
import { readFileSync, writeFileSync, existsSync } from "fs";

const SERVER_VERSION_FILE_PATH = join(__dirname, "./server.version");
const { COMMIT_HASH = "NO_HASH" } = process.env;
const DEVELOPMENT_VERSION = "DEVELOPMENT-VERSION";

function getDateVersion(): string {
  const date = new Date();

  const versionPrefix = [
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  ];
  const versionSuffix = [date.getHours(), date.getMinutes()];

  return [versionPrefix, versionSuffix]
    .map((versionPart) => padNumbers(versionPart, 2, "0").join("."))
    .join("_");
}

function readVersionFromFile(): string {
  return existsSync(SERVER_VERSION_FILE_PATH)
    ? readFileSync(SERVER_VERSION_FILE_PATH, "utf-8")
    : "";
}

function writeVersionToFile(version: string): void {
  writeFileSync(SERVER_VERSION_FILE_PATH, version);
}

function getVersion(): string {
  if (isDevEnvironment()) {
    return DEVELOPMENT_VERSION;
  }

  let serverVersion = readVersionFromFile();

  if (!serverVersion) {
    serverVersion = `${getDateVersion()}.${COMMIT_HASH}`;
    writeVersionToFile(serverVersion);
  }

  return serverVersion;
}

export const version = getVersion();
