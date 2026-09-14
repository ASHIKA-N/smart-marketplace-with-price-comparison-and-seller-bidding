import "dotenv/config";
import { StoreService } from "../src/store";
async function main() {
  const store = new StoreService();
  await store.onModuleInit();
  await store.seedDatabase();
  await store.prisma?.$disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
