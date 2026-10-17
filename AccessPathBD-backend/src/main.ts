import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "@/src/app.module";
import { configureApp } from "@/src/app.setup";
import { appConfig } from "@/config/app.config";
import { Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const env = appConfig.env;

  app.getHttpAdapter().getInstance().set("trust proxy", true);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Swagger UI needs 'unsafe-inline' to function correctly
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "validator.swagger.io"],
          connectSrc: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      // Evidence images are loaded by the separately-hosted Next.js frontend
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  // Request logger (method + path only; never log bodies or headers)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const now = new Date().toISOString().replace("T", " ").replace(/\..+/, "");
    console.log(
      `[HTTP] [${now}] ${req.method} ${req.originalUrl.split("?")[0]}`,
    );
    next();
  });

  configureApp(app);

  const swagger = new DocumentBuilder()
    .setTitle("AccessPath BD API")
    .setDescription(
      "Verified accessibility information for public buildings in Bangladesh",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(app, swagger),
  );

  app.use(cookieParser(env.COOKIE_SECRET));

  const allowedOrigins = (env.CORS_ORIGINS ?? env.FRONTEND_URL)
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    maxAge: 86400,
  });

  app.enableShutdownHooks();
  await app.listen(env.PORT);
  console.log(`API:     http://localhost:${env.PORT}/api/v1`);
  console.log(`Swagger: http://localhost:${env.PORT}/api/docs`);
}
bootstrap();
