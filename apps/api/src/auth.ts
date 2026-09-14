import {
  Inject,
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  CanActivate,
  ExecutionContext,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { hash, verify } from "argon2";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import type { Request } from "express";
import { StoreService } from "./store";
import { NotificationService } from "./notifications";
import type { User, PublicUser } from "../../../packages/shared/src";
export const publicUser = (u: User): PublicUser => {
  const { passwordHash: _passwordHash, ...safe } = u;
  return safe;
};
export const digest = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export type AuthRequest = Request & { user: PublicUser };
@Injectable()
export class AuthService {
  constructor(
    @Inject(StoreService) private readonly store: StoreService,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(NotificationService)
    private readonly notifications: NotificationService,
  ) {}
  async register(input: {
    name: string;
    email: string;
    password: string;
    seller: boolean;
  }) {
    const passwordHash = await hash(input.password);
    return this.store.mutate((s) => {
      if (s.users.some((u) => u.email === input.email))
        throw new ConflictException("This email is already registered.");
      const user: User = {
        id: randomUUID(),
        name: input.name,
        email: input.email,
        passwordHash,
        roles: input.seller ? ["BUYER", "SELLER"] : ["BUYER"],
        verified: false,
        active: true,
      };
      s.users.push(user);
      return publicUser(user);
    });
  }
  async login(email: string, password: string) {
    const user = (await this.store.read()).users.find(
      (u) => u.email === email && u.active,
    );
    if (!user || !(await verify(user.passwordHash, password)))
      throw new UnauthorizedException("Email or password is incorrect.");
    return this.issue(user);
  }
  private async issue(user: User) {
    const refresh = randomBytes(48).toString("hex");
    await this.store.mutate((s) => {
      s.sessions = s.sessions.filter((t) => new Date(t.expiresAt) > new Date());
      s.sessions.push({
        id: randomUUID(),
        userId: user.id,
        hash: digest(refresh),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
    });
    return {
      user: publicUser(user),
      accessToken: this.jwt.sign({ sub: user.id }, { expiresIn: "15m" }),
      refresh,
    };
  }
  async refresh(token: string) {
    const refresh = randomBytes(48).toString("hex");
    const user = await this.store.mutate((s) => {
      const session = s.sessions.find((t) => t.hash === digest(token));
      if (!session || new Date(session.expiresAt) <= new Date())
        throw new UnauthorizedException("Session expired. Please sign in.");
      const user = s.users.find((u) => u.id === session.userId && u.active);
      if (!user) throw new UnauthorizedException();
      s.sessions = s.sessions.filter((t) => t.id !== session.id);
      s.sessions.push({
        id: randomUUID(),
        userId: user.id,
        hash: digest(refresh),
        expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      return user;
    });
    return {
      user: publicUser(user),
      accessToken: this.jwt.sign({ sub: user.id }, { expiresIn: "15m" }),
      refresh,
    };
  }
  async logout(token: string) {
    await this.store.mutate((s) => {
      s.sessions = s.sessions.filter((t) => t.hash !== digest(token));
    });
    return { ok: true };
  }
  async authenticate(header?: string) {
    try {
      const payload = this.jwt.verify<{ sub: string }>(
        (header || "").replace(/^Bearer /, ""),
      );
      const user = (await this.store.read()).users.find(
        (u) => u.id === payload.sub && u.active,
      );
      if (!user) throw new Error();
      return publicUser(user);
    } catch {
      throw new UnauthorizedException("Please sign in to continue.");
    }
  }
  async token(email: string, kind: "reset" | "verify") {
    const token = randomBytes(32).toString("hex");
    const found = await this.store.mutate((s) => {
      const u = s.users.find((u) => u.email === email && u.active);
      if (!u) return false;
      s.tokens = s.tokens.filter(
        (t) => !(t.userId === u.id && t.kind === kind),
      );
      s.tokens.push({
        userId: u.id,
        hash: digest(token),
        kind,
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
      return true;
    });
    if (this.store.postgres && found)
      try {
        await this.notifications.recovery(email, token, kind);
      } catch {
        console.error(
          JSON.stringify({
            level: "error",
            service: "email-queue",
            message: "Unable to enqueue account email",
          }),
        );
      }
    return {
      message:
        "If this account exists, a link has been sent to its email address.",
      ...(!this.store.postgres && found ? { demoToken: token } : {}),
    };
  }
  async consumeToken(
    token: string,
    kind: "reset" | "verify",
    password?: string,
  ) {
    const passwordHash = password ? await hash(password) : undefined;
    return this.store.mutate((s) => {
      const t = s.tokens.find(
        (t) =>
          t.hash === digest(token) &&
          t.kind === kind &&
          new Date(t.expiresAt) > new Date(),
      );
      if (!t) throw new BadRequestException("This link is invalid or expired.");
      const user = s.users.find((u) => u.id === t.userId)!;
      if (kind === "verify") user.verified = true;
      else if (passwordHash) {
        user.passwordHash = passwordHash;
        s.sessions = s.sessions.filter((v) => v.userId !== user.id);
      }
      s.tokens = s.tokens.filter((v) => v !== t);
      return { ok: true };
    });
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AuthRequest>();
    req.user = await this.auth.authenticate(req.headers.authorization);
    return true;
  }
}
