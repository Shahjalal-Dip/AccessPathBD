import { RequestMethod, ValidationPipe } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AllExceptionsFilter } from "@/common/filters/all-exceptions.filter";

/**
 * Cross-cutting setup shared by main.ts AND the e2e tests, so tests exercise
 * exactly the same prefix / validation / error format as production.
 */
export function configureApp(app: NestExpressApplication) {
  app.setGlobalPrefix("api/v1", {
    exclude: [
      { path: "health", method: RequestMethod.GET },
      { path: "/", method: RequestMethod.GET },
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip unknown properties...
      forbidNonWhitelisted: true, // ...and reject them (e.g. a client sending "role")
      transform: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}
