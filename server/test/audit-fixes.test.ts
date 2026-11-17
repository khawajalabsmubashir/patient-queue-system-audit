import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createLocalApp } from "../app.ts";

test("audit fixes: backend validation rejects oversized/SQL/script inputs and >5MB appointment upload prep", async () => {
  const app = createLocalApp({ log: () => {} });
  app.http.listen(0, "127.0.0.1");
  await once(app.http, "listening");
  const address = app.http.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api`;

  async function req(
    path: string,
    cookie = "",
    body?: unknown,
    method = body === undefined ? "GET" : "POST",
  ) {
    const r = await fetch(base + path, {
      method,
      headers: { Cookie: cookie, "Content-Type": "application/json", "X-QueueCare-Request": "1" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return {
      status: r.status,
      json: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] ?? "",
    };
  }

  try {
    const sqlRes = await req("/auth/register", "", {
      fullName: "Robert'; DROP TABLE users;--",
      email: "sql@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(sqlRes.status, 400);

    const scriptRes = await req("/auth/register", "", {
      fullName: "<script>alert(1)</script>",
      email: "xss@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(scriptRes.status, 400);

    const longNameRes = await req("/auth/register", "", {
      fullName: "A".repeat(81),
      email: "long@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(longNameRes.status, 400);

    const longPhoneRes = await req("/auth/register", "", {
      fullName: "Valid Patient",
      email: "phone@example.com",
      phone: "1".repeat(25),
      password: "Password123!",
    });
    assert.equal(longPhoneRes.status, 400);

    const okPatient = await req("/auth/register", "", {
      fullName: "Valid Patient",
      email: "valid-audit@example.com",
      phone: "+923001234567",
      password: "Password123!",
    });
    assert.equal(okPatient.status, 201);

    // > 5MB upload preparation rejected by Zod fileSchema
    const bigUpload = await req("/appointments/any-id/attachments", okPatient.cookie, {
      type: "lab_report",
      title: "MRI Scan",
      filename: "mri-scan.pdf",
      mime: "application/pdf",
      size: 5 * 1024 * 1024 + 1,
    });
    assert.equal(bigUpload.status, 400);
  } finally {
    await app.close();
  }
});
