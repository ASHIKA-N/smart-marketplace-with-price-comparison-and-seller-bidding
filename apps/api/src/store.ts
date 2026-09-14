import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient, Prisma } from "@prisma/client";
import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import { hash } from "argon2";
import { randomBytes } from "node:crypto";
import { createSeed } from "../../../packages/shared/src/seed";
import { distanceKm, type Store } from "../../../packages/shared/src";

@Injectable()
export class StoreService implements OnModuleInit {
  private state!: Store;
  private tail: Promise<unknown> = Promise.resolve();
  private readonly file = resolve(
    process.env.DEMO_DATA_DIR || resolve(process.cwd(), "data"),
    "marketplace.json",
  );
  readonly postgres = process.env.DATABASE_MODE === "postgres";
  readonly prisma = this.postgres ? new PrismaClient() : undefined;
  async onModuleInit() {
    if (this.prisma) {
      await this.prisma.$connect();
      this.state = await this.readDatabase(this.prisma);
    } else {
      try {
        this.state = JSON.parse(await fs.readFile(this.file, "utf8")) as Store;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        this.state = await this.seed();
        await this.saveFile();
      }
    }
  }
  private async seed(): Promise<Store> {
    const state = createSeed();
    const passwordHash = await hash("DemoPass123!");
    state.users = [
      {
        id: "buyer-demo",
        name: "Alex Morgan",
        email: "buyer@aroundly.local",
        passwordHash,
        roles: ["BUYER"],
        verified: true,
        active: true,
      },
      ...["seller-demo", "seller-two", "seller-three", "seller-four"].map(
        (id, i) => ({
          id,
          name: ["Arjun Sharma", "Priya Rao", "Maya Patel", "Rohan Das"][i],
          email:
            i === 0 ? "seller@aroundly.local" : `seller${i + 1}@aroundly.local`,
          passwordHash,
          roles: ["BUYER", "SELLER"] as ("BUYER" | "SELLER")[],
          verified: true,
          active: true,
        }),
      ),
    ];
    return state;
  }
  async seedDatabase() {
    if (!this.prisma) throw new Error("Set DATABASE_MODE=postgres");
    const state = await this.seed();
    for (const user of state.users)
      user.passwordHash = await hash(randomBytes(32).toString("hex"));
    await this.prisma.$transaction(async (tx) => {
      if (await tx.user.count()) throw new Error("Database is not empty");
      await this.writeDatabase(tx, state);
    });
  }
  private async readDatabase(db: Prisma.TransactionClient): Promise<Store> {
    const [users, products, shops, listings, records] = await Promise.all([
      db.user.findMany(),
      db.product.findMany(),
      db.shop.findMany(),
      db.listing.findMany(),
      db.appRecord.findMany(),
    ]);
    const state = createSeed();
    state.users = users.map((r) => r.data) as unknown as Store["users"];
    state.products = products.map(
      (r) => r.data,
    ) as unknown as Store["products"];
    state.shops = shops.map((r) => r.data) as unknown as Store["shops"];
    state.listings = listings.map(
      (r) => r.data,
    ) as unknown as Store["listings"];
    for (const key of [
      "offers",
      "transactions",
      "reviews",
      "favorites",
      "sessions",
      "tokens",
      "notifications",
      "requests",
      "bids",
      "audits",
    ] as const) {
      Object.assign(state, {
        [key]: records.find((r) => r.key === key)?.data || [],
      });
    }
    return state;
  }
  private async writeDatabase(tx: Prisma.TransactionClient, state: Store) {
    const json = (v: unknown) =>
      JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
    for (const u of state.users)
      await tx.user.upsert({
        where: { id: u.id },
        create: { id: u.id, email: u.email, data: json(u) },
        update: { email: u.email, data: json(u) },
      });
    for (const p of state.products)
      await tx.product.upsert({
        where: { id: p.id },
        create: { id: p.id, name: p.name, category: p.category, data: json(p) },
        update: { name: p.name, category: p.category, data: json(p) },
      });
    for (const s of state.shops) {
      await tx.shop.upsert({
        where: { id: s.id },
        create: { id: s.id, ownerId: s.ownerId, data: json(s) },
        update: { data: json(s) },
      });
      await tx.$executeRaw`UPDATE "Shop" SET location=ST_SetSRID(ST_MakePoint(${s.lng},${s.lat}),4326)::geography WHERE id=${s.id}`;
    }
    for (const l of state.listings)
      await tx.listing.upsert({
        where: { id: l.id },
        create: {
          id: l.id,
          shopId: l.shopId,
          productId: l.productId,
          price: l.price,
          stock: l.stock,
          data: json(l),
        },
        update: { price: l.price, stock: l.stock, data: json(l) },
      });
    for (const key of [
      "offers",
      "transactions",
      "reviews",
      "favorites",
      "sessions",
      "tokens",
      "notifications",
      "requests",
      "bids",
      "audits",
    ] as const)
      await tx.appRecord.upsert({
        where: { key },
        create: { key, data: json(state[key]) },
        update: { data: json(state[key]) },
      });
  }
  private async saveFile() {
    await fs.mkdir(resolve(this.file, ".."), { recursive: true });
    const temp = `${this.file}.tmp`;
    await fs.writeFile(temp, JSON.stringify(this.state, null, 2));
    await fs.rename(temp, this.file);
  }
  async read() {
    if (this.prisma) return this.readDatabase(this.prisma);
    return structuredClone(this.state);
  }
  async mutate<T>(fn: (state: Store) => Promise<T> | T): Promise<T> {
    const run = this.tail.then(async () => {
      if (this.prisma)
        return this.prisma.$transaction(
          async (tx) => {
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(727261)`;
            const state = await this.readDatabase(tx);
            const result = await fn(state);
            await this.writeDatabase(tx, state);
            return result;
          },
          { timeout: 30000 },
        );
      const before = structuredClone(this.state);
      try {
        const result = await fn(this.state);
        await this.saveFile();
        return result;
      } catch (error) {
        this.state = before;
        throw error;
      }
    });
    this.tail = run.catch(() => undefined);
    return run;
  }
  async nearby(lat: number, lng: number, radius: number) {
    if (this.prisma)
      return this.prisma.$queryRaw<
        { id: string; distance: number }[]
      >`SELECT id, ST_Distance(location, ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography)/1000 AS distance FROM "Shop" WHERE ST_DWithin(location,ST_SetSRID(ST_MakePoint(${lng},${lat}),4326)::geography,${radius * 1000}) ORDER BY distance, id LIMIT 100`;
    return (await this.read()).shops
      .map((s) => ({ id: s.id, distance: distanceKm(lat, lng, s.lat, s.lng) }))
      .filter((s) => s.distance <= radius)
      .sort((a, b) => a.distance - b.distance);
  }
  async matchingProducts(query: string): Promise<string[] | undefined> {
    if (!this.prisma || !query.trim()) return undefined;
    const q = query.trim().toLowerCase();
    const rows = await this.prisma.$queryRaw<
      { id: string }[]
    >`SELECT id FROM "Product" WHERE to_tsvector('simple', name || ' ' || category || ' ' || COALESCE(data->>'brand','') || ' ' || COALESCE(data->>'tags','')) @@ plainto_tsquery('simple',${q}) OR name % ${q} OR name ILIKE ${"%" + q + "%"} ORDER BY similarity(name,${q}) DESC,id LIMIT 500`;
    return rows.map((r) => r.id);
  }
}
