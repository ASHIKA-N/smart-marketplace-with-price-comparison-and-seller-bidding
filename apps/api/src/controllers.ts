import {
  Inject,
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  ForbiddenException,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { z } from "zod";
import { hash, verify } from "argon2";
import { randomUUID } from "node:crypto";
import { AuthService, AuthGuard, type AuthRequest, publicUser } from "./auth";
import { MarketplaceService, requireSeller } from "./marketplace";
import { StoreService } from "./store";
import { NotificationService } from "./notifications";
const email = z
  .string()
  .email()
  .max(254)
  .transform((v) => v.trim().toLowerCase());
const password = z.string().min(10).max(128);
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/v1/auth",
  maxAge: 7 * 86400000,
};
@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  @Post("register") async register(@Body() body: unknown) {
    return this.auth.register(
      z
        .object({
          name: z.string().min(2).max(80),
          email,
          password,
          seller: z.boolean().default(false),
        })
        .parse(body),
    );
  }
  @Post("login") async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = z.object({ email, password: z.string().max(128) }).parse(body);
    const { refresh, ...result } = await this.auth.login(
      data.email,
      data.password,
    );
    res.cookie("refresh", refresh, cookieOptions);
    return result;
  }
  @Post("refresh") async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refresh, ...result } = await this.auth.refresh(
      String(req.cookies?.refresh || ""),
    );
    res.cookie("refresh", refresh, cookieOptions);
    return result;
  }
  @Post("logout") async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.auth.logout(String(req.cookies?.refresh || ""));
    res.clearCookie("refresh", cookieOptions);
    return result;
  }
  @Post("forgot-password") forgot(@Body() body: unknown) {
    return this.auth.token(z.object({ email }).parse(body).email, "reset");
  }
  @Post("reset-password") reset(@Body() body: unknown) {
    const data = z.object({ token: z.string().min(10), password }).parse(body);
    return this.auth.consumeToken(data.token, "reset", data.password);
  }
  @UseGuards(AuthGuard) @Post("send-verification") verification(
    @Req() req: AuthRequest,
  ) {
    return this.auth.token(req.user.email, "verify");
  }
  @Post("verify-email") verify(@Body() body: unknown) {
    return this.auth.consumeToken(
      z.object({ token: z.string().min(10) }).parse(body).token,
      "verify",
    );
  }
}
@ApiTags("Marketplace")
@Controller()
export class MarketplaceController {
  constructor(
    @Inject(MarketplaceService) private readonly market: MarketplaceService,
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(NotificationService)
    private readonly notificationService: NotificationService,
  ) {}
  @Get("health") health() {
    return {
      status: "ok",
      mode: this.store.postgres ? "postgres" : "demo",
      service: "aroundly-api",
    };
  }
  @Get("health/ready") async ready() {
    await this.store.read();
    return { status: "ready", ...(await this.notificationService.ready()) };
  }
  @Get("products") products(@Query() q: unknown) {
    return this.market.search(q);
  }
  @Get("products/search") search(@Query() q: unknown) {
    return this.market.search(q);
  }
  @Get("products/:id") async product(
    @Param("id") id: string,
    @Query() q: unknown,
    @Req() req: Request,
  ) {
    return this.market.product(
      id,
      q,
      req.headers.authorization
        ? await this.auth.authenticate(req.headers.authorization)
        : undefined,
    );
  }
  @Get("products/:id/compare") compare(
    @Param("id") id: string,
    @Query() q: unknown,
    @Req() req: Request,
  ) {
    return this.product(id, q, req);
  }
  @Get("shops") shops(@Query() q: unknown) {
    return this.market.shops(q);
  }
  @Get("shops/nearby") nearby(@Query() q: unknown) {
    return this.market.shops(q);
  }
  @Get("shops/:id") shop(@Param("id") id: string) {
    return this.market.shop(id);
  }
  @UseGuards(AuthGuard) @Post("shops") saveShop(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.saveShop(req.user, body);
  }
  @UseGuards(AuthGuard) @Patch("shops/:id") updateShop(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Param("id") id: string,
  ) {
    return this.market.saveShop(req.user, body, id);
  }
  @UseGuards(AuthGuard) @Post("products") createProduct(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.createProduct(req.user, body);
  }
  @UseGuards(AuthGuard) @Post("listings") listing(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.saveListing(req.user, body);
  }
  @UseGuards(AuthGuard) @Patch("listings/:id") updateListing(
    @Req() req: AuthRequest,
    @Body() body: unknown,
    @Param("id") id: string,
  ) {
    return this.market.saveListing(req.user, body, id);
  }
  @UseGuards(AuthGuard) @Post("offers") offer(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.offer(req.user, body);
  }
  @UseGuards(AuthGuard) @Get("seller") seller(@Req() req: AuthRequest) {
    requireSeller(req.user);
    return this.market.dashboard(req.user);
  }
  @UseGuards(AuthGuard) @Get("transactions") transactions(
    @Req() req: AuthRequest,
  ) {
    return this.market.transactions(req.user);
  }
  @UseGuards(AuthGuard) @Post("transactions") reserve(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.reserve(req.user, body);
  }
  @UseGuards(AuthGuard) @Patch("transactions/:id") transition(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    return this.market.transition(req.user, id, body);
  }
  @UseGuards(AuthGuard) @Post("reviews") review(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.review(req.user, body);
  }
  @UseGuards(AuthGuard) @Get("favorites") favorites(@Req() req: AuthRequest) {
    return this.market.favorites(req.user);
  }
  @UseGuards(AuthGuard) @Post("favorites") favorite(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.favorite(req.user, body);
  }
  @UseGuards(AuthGuard) @Get("requests") requests(@Req() req: AuthRequest) {
    return this.market.requests(req.user);
  }
  @UseGuards(AuthGuard) @Post("requests") request(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.request(req.user, body);
  }
  @UseGuards(AuthGuard) @Post("bids") bid(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    return this.market.bid(req.user, body);
  }
  @UseGuards(AuthGuard) @Get("notifications") async notifications(
    @Req() req: AuthRequest,
  ) {
    return (await this.store.read()).notifications.filter(
      (n) => n.userId === req.user.id,
    );
  }
  @UseGuards(AuthGuard) @Post("notifications/read") async readNotifications(
    @Req() req: AuthRequest,
  ) {
    return this.store.mutate((s) => {
      s.notifications
        .filter((n) => n.userId === req.user.id)
        .forEach((n) => (n.read = true));
      return { ok: true };
    });
  }
}
@ApiTags("Accounts")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("users")
export class UsersController {
  constructor(@Inject(StoreService) private readonly store: StoreService) {}
  @Get("me") me(@Req() req: AuthRequest) {
    return req.user;
  }
  @Patch("me") async update(@Req() req: AuthRequest, @Body() body: unknown) {
    const data = z
      .object({
        name: z.string().min(2).max(80),
        seller: z.boolean().optional(),
      })
      .parse(body);
    return this.store.mutate((s) => {
      const u = s.users.find((u) => u.id === req.user.id)!;
      u.name = data.name;
      if (data.seller && !u.roles.includes("SELLER")) u.roles.push("SELLER");
      return publicUser(u);
    });
  }
  @Post("me/password") async changePassword(
    @Req() req: AuthRequest,
    @Body() body: unknown,
  ) {
    const data = z
      .object({ currentPassword: z.string(), password })
      .parse(body);
    return this.store.mutate(async (s) => {
      const u = s.users.find((u) => u.id === req.user.id)!;
      if (!(await verify(u.passwordHash, data.currentPassword)))
        throw new ForbiddenException("Current password is incorrect.");
      u.passwordHash = await hash(data.password);
      s.sessions = s.sessions.filter((t) => t.userId !== u.id);
      return { ok: true };
    });
  }
  @Get("admin") async admin(@Req() req: AuthRequest) {
    if (!req.user.roles.includes("ADMIN")) throw new ForbiddenException();
    const s = await this.store.read();
    return {
      users: s.users.map(publicUser),
      shops: s.shops,
      reviews: s.reviews,
      audits: s.audits,
    };
  }
  @Patch("admin/:id") async moderate(
    @Req() req: AuthRequest,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    if (!req.user.roles.includes("ADMIN")) throw new ForbiddenException();
    const { active } = z.object({ active: z.boolean() }).parse(body);
    return this.store.mutate((s) => {
      const u = s.users.find((u) => u.id === id);
      if (!u || u.roles.includes("ADMIN")) throw new ForbiddenException();
      u.active = active;
      s.sessions = s.sessions.filter((t) => t.userId !== id);
      s.audits.push({
        id: randomUUID(),
        actorId: req.user.id,
        action: `User ${id} active=${active}`,
        createdAt: new Date().toISOString(),
      });
      return publicUser(u);
    });
  }
}
