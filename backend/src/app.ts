import cors from "cors";
import helmet from "helmet";
import addApiRoutes from "./api/routes";
import express, { urlencoded, json } from "express";
import {
  contextMiddleware,
  errorHandlingMiddleware,
  badAuthRateLimiterHandler,
  rootRateLimiter,
} from "./middlewares";

function buildApp(): express.Application {
  const app = express();

  const middlewares = [
    urlencoded({ extended: true }),
    json(),
    cors(),
    helmet(),
    contextMiddleware,
    badAuthRateLimiterHandler,
    rootRateLimiter,
    errorHandlingMiddleware,
  ];

  app.set("trust proxy", 1);

  middlewares.forEach((middleware) => app.use(middleware));

  addApiRoutes(app);

  return app;
}

export default buildApp();
