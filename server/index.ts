import { createPostgresDatabase } from "./db/postgres.ts";
import { createLocalApp } from "./app.ts";
const port = Number(process.env["PORT"] ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error("PORT must be a valid local port.");
const databaseUrl = process.env["DATABASE_URL"];
let database;
if (databaseUrl) {
  try {
    database = await createPostgresDatabase(databaseUrl);
    console.log("QueueCare connected to PostgreSQL database.");
  } catch (err) {
    console.warn("Could not connect to PostgreSQL database, falling back to local SQLite:", err);
  }
}
const instance = createLocalApp({
  ...(database ? { database } : { dbPath: process.env["DB_PATH"] || "data/queuecare.db" }),
  appUrl: process.env["APP_URL"] ?? "http://localhost:3000",
});
instance.http.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is occupied. Stop the process using it, then run npm.cmd run demo again.`
      : error.message,
  );
  void instance.db.close();
  process.exit(1);
});
instance.http.listen(port, "127.0.0.1", () => {
  console.log(
    database ? "QueueCare Supabase PostgreSQL database ready." : "QueueCare SQLite database ready.",
  );
  console.log(`API server: http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void instance.close().then(() => process.exit(0));
  });
