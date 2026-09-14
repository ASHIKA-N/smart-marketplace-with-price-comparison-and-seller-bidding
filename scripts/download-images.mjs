import { mkdir, writeFile } from "node:fs/promises";
const ids = [
  "photo-1546435770-a3e426bf472b",
  "photo-1542291026-7eec264c27ff",
  "photo-1514228742587-6b1558fcca3d",
  "photo-1523049673857-eb18f1d7b578",
  "photo-1608571423902-eed4a5ad8108",
  "photo-1459411552884-841db9b3cc2a",
  "photo-1516035069371-29a1b244cc32",
  "photo-1559056199-641a0ac8b55e",
  "photo-1441986300917-64674bd600d8",
  "photo-1473181488821-2d23949a045a",
  "photo-1493857671505-72967e2e2760",
  "photo-1542838132-92c53300491e",
  "photo-1490312278390-ab64016e0aa9",
];
await mkdir("apps/web/public/images", { recursive: true });
const results = await Promise.allSettled(
  ids.map(async (id) => {
    const response = await fetch(
      `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=85`,
    );
    if (!response.ok) throw new Error(`${id}: ${response.status}`);
    await writeFile(
      `apps/web/public/images/${id}.jpg`,
      Buffer.from(await response.arrayBuffer()),
    );
    console.log(`Saved ${id}`);
  }),
);
for (const r of results)
  if (r.status === "rejected") {
    console.error(r.reason);
    process.exitCode = 1;
  }
