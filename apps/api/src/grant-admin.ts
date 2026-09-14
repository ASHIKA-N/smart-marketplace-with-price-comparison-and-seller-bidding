import "reflect-metadata";
import "dotenv/config";
import { randomUUID } from "node:crypto";
import { StoreService } from "./store";
async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email)
    throw new Error(
      "Usage: pnpm exec tsx src/grant-admin.ts email@example.com",
    );
  const store = new StoreService();
  await store.onModuleInit();
  await store.mutate((s) => {
    const user = s.users.find((u) => u.email === email);
    if (!user) throw new Error("Register the account first.");
    if (!user.roles.includes("ADMIN")) user.roles.push("ADMIN");
    s.audits.push({
      id: randomUUID(),
      actorId: "local-administrator",
      action: `Granted administrator access to ${user.id}`,
      createdAt: new Date().toISOString(),
    });
  });
  await store.prisma?.$disconnect();
  console.log(
    "Administrator access granted. Sign in again to refresh your account.",
  );
}
void main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed");
  process.exitCode = 1;
});
