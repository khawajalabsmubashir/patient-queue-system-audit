import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createLocalApp } from "../app.ts";
import { testDoctorHours } from "./availability-fixture.ts";
import { clinicDayKey } from "../../src/domain/queue.js";

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

    // Empty email error message + 50 char name cap
    const emptyEmailRes = await req("/auth/register", "", {
      fullName: "Valid Patient",
      email: "",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(emptyEmailRes.status, 400);
    assert.equal(emptyEmailRes.json.error.message, "Email is required.");

    const over50Res = await req("/auth/register", "", {
      fullName: "A".repeat(51),
      email: "over50@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(over50Res.status, 400);

    const exact50Res = await req("/auth/register", "", {
      fullName: "A".repeat(50),
      email: "exact50@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(exact50Res.status, 201);

    const longPhoneRes = await req("/auth/register", "", {
      fullName: "Valid Patient",
      email: "phone@example.com",
      phone: "1".repeat(25),
      password: "Password123!",
    });
    assert.equal(longPhoneRes.status, 400);

    // BUG-02: spaces-only password rejected
    const spacesPwRes = await req("/auth/register", "", {
      fullName: "Spaces Password Patient",
      email: "spaces@example.com",
      phone: "03001234567",
      password: "         ",
    });
    assert.equal(spacesPwRes.status, 400);

    // BUG-04: 1-char and 2-char names rejected
    const oneCharRes = await req("/auth/register", "", {
      fullName: "A",
      email: "onechar@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(oneCharRes.status, 400);

    const twoCharRes = await req("/auth/register", "", {
      fullName: "Ab",
      email: "twochar@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(twoCharRes.status, 400);

    // BUG-07: special-characters-only name rejected
    const specialCharsRes = await req("/auth/register", "", {
      fullName: "@#$%^&&^%$#",
      email: "special@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(specialCharsRes.status, 400);

    // BUG-06 (expected behavior): distinct emails may share Full name regardless of case, while duplicate emails are rejected case-insensitively
    const sameName1 = await req("/auth/register", "", {
      fullName: "Teststaff",
      email: "teststaff1@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(sameName1.status, 201);
    const sameName2 = await req("/auth/register", "", {
      fullName: "teststaff",
      email: "teststaff2@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(sameName2.status, 201);
    const dupEmailCase = await req("/auth/register", "", {
      fullName: "Another Name",
      email: "TESTSTAFF1@example.com",
      phone: "03001234567",
      password: "Password123!",
    });
    assert.equal(dupEmailCase.status, 409);

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

    // Receptionist appointment booking for first-time registered patient & new walk-in patient
    await testDoctorHours(app.db, "northstar");
    const admin = await req("/auth/login", "", {
      email: process.env["QUEUECARE_ADMIN_EMAIL"] ?? "admin@queuecare.local",
      password: process.env["QUEUECARE_ADMIN_PASSWORD"] ?? "QueueCareAdmin123!",
      portal: "staff",
    });
    assert.equal(admin.status, 200);

    const createReception = await req("/admin/staff", admin.cookie, {
      fullName: "Desk Receptionist",
      email: "desk-audit@example.com",
      phone: "03001234567",
      role: "receptionist",
      clinicIds: ["northstar"],
      password: "StaffPassword123!",
      active: true,
    });
    assert.equal(createReception.status, 201);

    const reception = await req("/auth/login", "", {
      email: "desk-audit@example.com",
      password: "StaffPassword123!",
      portal: "staff",
    });
    assert.equal(reception.status, 200);

    const targetDate = "2030-01-07";
    const slotsRes = await req("/appointments/available-slots?clinicId=northstar&date=" + targetDate, reception.cookie);
    assert.equal(slotsRes.status, 200);
    const firstSlot = slotsRes.json.data.slots[0]?.value ?? `${targetDate}T09:00`;
    const secondSlot = slotsRes.json.data.slots[1]?.value ?? `${targetDate}T09:15`;

    const firstVisitRes = await req("/staff/appointments?clinicId=northstar", reception.cookie, {
      patientId: okPatient.json.data.id,
      scheduledAt: firstSlot,
      reason: "Arrived at clinic desk",
    });
    assert.equal(firstVisitRes.status, 201);

    const badWalkInRes = await req("/staff/appointments?clinicId=northstar", reception.cookie, {
      walkIn: {
        fullName: "Walkin'; DROP TABLE users;--",
        phone: "03009876543",
      },
      scheduledAt: secondSlot,
      reason: "",
    });
    assert.equal(badWalkInRes.status, 400);

    const walkInRes = await req("/staff/appointments?clinicId=northstar", reception.cookie, {
      walkIn: {
        fullName: "Walkin Visitor",
        phone: "03009876543",
        email: "walkin-visitor@example.com",
      },
      scheduledAt: secondSlot,
      reason: "Walk-in consultation",
    });
    assert.equal(walkInRes.status, 201);

    const wrongClinicRes = await req("/staff/appointments?clinicId=unassigned", reception.cookie, {
      patientId: okPatient.json.data.id,
      scheduledAt: secondSlot,
      reason: "",
    });
    assert.equal(wrongClinicRes.status, 403);

    // BUG-10: Reject reusing current password as new password
    const samePwRes = await req("/account/password", okPatient.cookie, {
      currentPassword: "Password123!",
      newPassword: "Password123!",
    }, "PUT");
    assert.equal(samePwRes.status, 400);
    assert.equal(samePwRes.json.error.message, "New password must be different from the current password.");

    // BUG-11: Repeated wrong password attempts always return clear error & lock after 5 attempts
    for (let attempt = 1; attempt <= 7; attempt++) {
      const failLogin = await req("/auth/login", "", {
        email: "valid-audit@example.com",
        password: "WrongPassword999!",
        portal: "patient",
      });
      assert.equal(failLogin.status, attempt >= 5 ? 429 : 401);
      assert.ok(typeof failLogin.json.error.message === "string" && failLogin.json.error.message.length > 0);
    }
  } finally {
    await app.close();
  }
});
