import "dotenv/config";
import { connect as connectDb } from "./init/db";
import { init as initJobs } from "./jobs";
import { getLiveConfiguration } from "./init/configuration";
import app from "./app";
import { Server } from "http";
import { version, recordServerVersion } from "./version";
import { connect as connectRedis, isConnected as isRedisConnected, getConnection as getRedisConnection } from "./init/redis";
import { initQueues, initWorkers } from "./queues";
import Logger from "./utils/logger";
import { init as initEmailClient } from "./init/email-client";
import { init as initFirebaseAdmin } from "./init/firebase-admin";
import { createIndicies as leaderboardDbSetup } from "./dal/leaderboards";

async function bootServer(port: number): Promise<Server> {
  try {
    Logger.info(`Starting server version ${version}`);
    Logger.info(`Starting server in ${process.env["MODE"]} mode`);
    Logger.info(`Connecting to database ${process.env["DB_NAME"]}...`);
    await connectDb();
    Logger.success("Connected to database");

    Logger.info("Initializing Firebase app instance...");
    initFirebaseAdmin();

    Logger.info("Fetching live configuration...");
    await getLiveConfiguration();
    Logger.success("Live configuration fetched");

    Logger.info("Initializing email client...");
    await initEmailClient();

    Logger.info("Connecting to redis...");
    await connectRedis();

    if (isRedisConnected()) {
      Logger.success("Connected to redis");
      const connection = getRedisConnection();

      Logger.info("Initializing queues...");
      initQueues(connection);
      Logger.success("Queues initialized");

      Logger.info("Initializing workers...");
      initWorkers(connection);
      Logger.success("Workers initialized");
    }

    Logger.info("Starting cron jobs...");
    initJobs();
    Logger.success("Cron jobs started");

    Logger.info("Setting up leaderboard indicies...");
    await leaderboardDbSetup();

    recordServerVersion(version);
  } catch (error) {
    Logger.error("Failed to boot server");
    Logger.error(error.message);
    console.error(error);
    return process.exit(1);
  }

  return app.listen(PORT, () => {
    Logger.success(`API server listening on port ${port}`);
  });
}

const PORT = parseInt(process.env["PORT"] ?? "5005", 10);

void bootServer(PORT);
