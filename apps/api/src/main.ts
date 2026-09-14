import "reflect-metadata";
import "dotenv/config";
import {
  Module,
  Catch,
  ExceptionFilter,
  ArgumentsHost,
  HttpException,
} from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { z, ZodError } from "zod";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import type { Request, Response, NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { StoreService } from "./store";
import { NotificationService } from "./notifications";
import { AuthService, AuthGuard } from "./auth";
import { MarketplaceService } from "./marketplace";
import {
  AuthController,
  MarketplaceController,
  UsersController,
} from "./controllers";
const env = z
  .object({
    PORT: z.coerce.number().default(4000),
    WEB_URL: z.string().url().default("http://localhost:3000"),
    DATABASE_MODE: z.enum(["demo", "postgres"]).default("demo"),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    JWT_SECRET: z
      .string()
      .min(32)
      .default("local-demo-only-secret-change-in-production-123456"),
  })
  .parse(process.env);
if (
  env.NODE_ENV === "production" &&
  (env.DATABASE_MODE !== "postgres" ||
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.startsWith("local-demo"))
)
  throw new Error(
    "Production requires Postgres and an explicit secure JWT_SECRET.",
  );
@Catch()
class ErrorFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const status =
      error instanceof ZodError
        ? 400
        : error instanceof HttpException
          ? error.getStatus()
          : 500;
    const message =
      error instanceof ZodError
        ? error.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join("; ")
        : error instanceof HttpException
          ? error.message
          : "An unexpected error occurred.";
    if (status === 500)
      console.error(
        JSON.stringify({
          level: "error",
          requestId: res.getHeader("x-request-id"),
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    res
      .status(status)
      .json({
        status,
        code: status === 400 ? "VALIDATION_ERROR" : `HTTP_${status}`,
        message,
        requestId: res.getHeader("x-request-id"),
      });
  }
}
@Module({
  imports: [JwtModule.register({ secret: env.JWT_SECRET })],
  controllers: [AuthController, MarketplaceController, UsersController],
  providers: [
    StoreService,
    AuthService,
    AuthGuard,
    MarketplaceService,
    NotificationService,
  ],
})
class AppModule {}
if (
  env.NODE_ENV === "production" &&
  (!process.env.REDIS_URL ||
    !process.env.RESEND_API_KEY ||
    !process.env.MAIL_FROM)
)
  throw new Error("Production requires Redis and email delivery credentials.");
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.setGlobalPrefix("api/v1");
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: env.WEB_URL, credentials: true });
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("x-request-id", randomUUID());
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== env.WEB_URL
    ) {
      res.status(403).json({ message: "Origin not allowed." });
      return;
    }
    next();
  });
  app.use(
    "/api/v1/auth",
    rateLimit({
      windowMs: 15 * 60000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.useGlobalFilters(new ErrorFilter());
  SwaggerModule.setup(
    "api/docs",
    app,
    SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle("Aroundly Marketplace")
        .setDescription(
          "Local discovery, comparisons, reservations and seller bidding.",
        )
        .setVersion("1.0")
        .addBearerAuth()
        .build(),
    ),
  );
  await app.listen(env.PORT, "0.0.0.0");
}
void bootstrap();
