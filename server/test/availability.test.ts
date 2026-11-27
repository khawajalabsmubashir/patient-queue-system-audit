import { test } from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createLocalApp } from "../app.ts";
import { createPostgresDatabase } from "../db/postgres.ts";
import { one, many } from "../db/database.ts";

test(
  "clinic hours availability: auto-syncs doctor schedule to clinic opening/closing times, enforces slots, security, concurrency, rescheduling and historical preservation",
  { timeout: process.env["QUEUECARE_AVAILABILITY_TEST_SCHEMA"] ? 900000 : 180000 },
  async (t) => {
    const database = process.env["QUEUECARE_AVAILABILITY_TEST_SCHEMA"]
      ? await createPostgresDatabase(
          process.env["DATABASE_URL"]!,
          true,
          process.env["QUEUECARE_AVAILABILITY_TEST_SCHEMA"],
          () => {},
        )
      : undefined;
    const app = createLocalApp({ ...(database ? { database } : {}), log: () => {} });
    app.http.listen(0, "127.0.0.1");
    await once(app.http, "listening");
    const address = app.http.address();
    assert.ok(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}/api`;
    // Deterministic Karachi clock, independently exercising past-day and past-time rejection.
    t.mock.method(Date, "now", () => +new Date("2030-01-07T10:15:00+05:00"));
    async function req(
      path: string,
      cookie = "",
      body?: unknown,
      method = body === undefined ? "GET" : "POST",
    ) {
      const res = await fetch(base + path, {
        method,
        headers: { Cookie: cookie, "Content-Type": "application/json", "X-QueueCare-Request": "1" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const envelope = await res.json();
      return {
        status: res.status,
        data: envelope.data,
        error: envelope.error,
        cookie: res.headers.get("set-cookie")?.split(";")[0] ?? "",
      };
    }
    try {
      const admin = await req("/auth/login", "", {
        email: process.env["QUEUECARE_ADMIN_EMAIL"] ?? "admin@queuecare.local",
        password: process.env["QUEUECARE_ADMIN_PASSWORD"] ?? "QueueCareAdmin123!",
      });
      assert.equal(admin.status, 200);
      const patient = await req("/auth/register", "", {
        fullName: "Availability Patient",
        email: "slots@queuecare.test",
        phone: "03001234567",
        password: "PatientPassword123!",
      });
      assert.equal(patient.status, 201);
      const other = await req("/auth/register", "", {
        fullName: "Other Booking",
        email: "slots-other@queuecare.test",
        phone: "03001234568",
        password: "PatientPassword123!",
      });
      const body = {
        name: "Evening Clinic",
        publicName: "Evening Clinic",
        address: "Clinic",
        phone: "03001234567",
        department: "General",
        doctor: "Doctor",
        opening: "18:00",
        closing: "20:00",
        city: "Karachi",
        area: "Test area",
        prefix: "E",
        showNext: true,
        avgMin: 5,
        active: true,
        consultationFee: null,
      };
      const branch = await req("/admin/clinics", admin.cookie, body);
      assert.equal(branch.status, 201);
      // Creating a clinic automatically syncs doctor_availability to its opening & closing hours.
      const synced = await many<{ weekday: number; start_time: string; end_time: string }>(
        app.db,
        "SELECT weekday,start_time,end_time FROM doctor_availability WHERE clinic_id=? ORDER BY weekday",
        branch.data.id,
      );
      assert.equal(synced.length, 7);
      assert.ok(synced.every((w) => w.start_time === "18:00" && w.end_time === "20:00"));

      // Updating a clinic updates its synced doctor schedule hours too.
      assert.equal(
        (
          await req("/admin/clinics/" + branch.data.id, admin.cookie, {
            ...body,
            opening: "17:00",
            closing: "19:00",
          }, "PUT")
        ).status,
        200,
      );
      const updatedSync = await many<{ start_time: string; end_time: string }>(
        app.db,
        "SELECT start_time,end_time FROM doctor_availability WHERE clinic_id=?",
        branch.data.id,
      );
      assert.ok(updatedSync.every((w) => w.start_time === "17:00" && w.end_time === "19:00"));

      // Default clinic (Northstar 09:00-17:00) immediately allows patient & admin bookings based on clinic hours without manual Doctor Schedule setup.
      const slotsUrl = "/appointments/available-slots?clinicId=northstar&date=2030-01-07";
      const readSlots = async (url = slotsUrl) =>
        (await req(url, patient.cookie)).data.slots.map((s: { value: string }) => s.value);
      const northstarTodaySlots = await readSlots();
      assert.equal(northstarTodaySlots[0], "2030-01-07T10:30");
      assert.equal(northstarTodaySlots.at(-1), "2030-01-07T16:45");
      assert.ok(!JSON.stringify((await req(slotsUrl, patient.cookie)).data).includes("doctorId"));

      const branchSlots = await readSlots(
        `/appointments/available-slots?clinicId=${branch.data.id}&date=2030-01-07`,
      );
      assert.deepEqual(
        branchSlots,
        ["17:00", "17:15", "17:30", "17:45", "18:00", "18:15", "18:30", "18:45"].map(
          (t) => "2030-01-07T" + t,
        ),
      );
      // Past date returns no slots; invalid date returns 400.
      assert.deepEqual(
        (await req(slotsUrl.replace("2030-01-07", "2029-12-31"), patient.cookie)).data.slots,
        [],
      );
      assert.equal(
        (await req(slotsUrl.replace("2030-01-07", "2030-02-31"), patient.cookie)).status,
        400,
      );

      const booking = (time: string, cookie = patient.cookie) =>
        req("/patient/appointments", cookie, {
          clinicId: "northstar",
          scheduledAt: "2030-01-07T" + time,
          reason: "Review",
        });
      for (const time of ["08:30", "10:00", "10:35", "17:00"])
        assert.equal((await booking(time)).status, 409);

      const simultaneous = await Promise.all([booking("10:30"), booking("10:30", other.cookie)]);
      assert.deepEqual(simultaneous.map((r) => r.status).sort(), [201, 409]);
      const booked = simultaneous.find((r) => r.status === 201)!;
      assert.ok(!(await readSlots()).includes("2030-01-07T10:30"));
      assert.equal(
        (
          await one<{ count: number }>(
            app.db,
            "SELECT CAST(COUNT(*) AS INTEGER) count FROM appointments WHERE scheduled_at=?",
            "2030-01-07T10:30",
          )
        )?.count,
        1,
      );
      assert.equal(
        (
          await one<{ duration_minutes: number }>(
            app.db,
            "SELECT duration_minutes FROM appointment_slots WHERE appointment_id=?",
            booked.data.id,
          )
        )?.duration_minutes,
        15,
      );
      // Patient cannot probe another patient's appointment via exclude.
      assert.equal(
        (
          await req(
            "/appointments/available-slots?clinicId=" +
              branch.data.id +
              "&date=2030-01-07&exclude=" +
              booked.data.id,
            patient.cookie,
          )
        ).status,
        403,
      );
      // Admin can also book within clinic hours and rejects out-of-hours bookings.
      assert.equal(
        (
          await req("/admin/appointments?clinicId=northstar", admin.cookie, {
            patientId: patient.data.id,
            scheduledAt: "2030-01-07T17:30",
            reason: "",
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await req("/admin/appointments?clinicId=northstar", admin.cookie, {
            patientId: patient.data.id,
            scheduledAt: "2030-01-07T14:00",
            reason: "Clinic hours admin booking",
          })
        ).status,
        201,
      );
      const update = (time: string, status = "scheduled") =>
        req(
          "/operations/appointments/" + booked.data.id,
          admin.cookie,
          { scheduledAt: "2030-01-07T" + time, status },
          "PUT",
        );
      assert.equal((await update("17:30")).status, 409);
      assert.equal((await update("11:00")).status, 200);
      assert.ok((await readSlots()).includes("2030-01-07T10:30"));
      assert.equal(
        (await req(slotsUrl + "&exclude=" + booked.data.id, admin.cookie)).data.slots.some(
          (s: { value: string }) => s.value.endsWith("11:00"),
        ),
        true,
      );
      assert.equal((await update("11:00", "cancelled")).status, 200);
      assert.ok((await readSlots()).includes("2030-01-07T11:00"));
      assert.equal((await update("11:00", "scheduled")).status, 409);
      assert.equal((await update("11:00", "no_show")).status, 409);
      assert.ok((await readSlots()).includes("2030-01-07T11:00"));
      assert.equal((await booking("11:00")).status, 201);

      // Branding slot duration update preserves previously reserved appointments' duration.
      assert.equal(
        (
          await req(
            "/admin/branding?clinicId=northstar",
            admin.cookie,
            {
              doctor: {
                full_name: "Doctor",
                title: "",
                specialty: "",
                license: "",
                phone: "",
                email: "",
                photo_url: "",
                signature_url: "",
              },
              clinic: { email: "", logo_url: "", footer: "", slot_minutes: 30 },
            },
            "PUT",
          )
        ).status,
        200,
      );
      const history = await many(app.db, "SELECT * FROM appointments ORDER BY id");
      assert.ok(history.length >= 3);
      // Legacy status updates work on existing scheduled appointments.
      const current = await one<{ id: string; scheduled_at: string }>(
        app.db,
        "SELECT id,scheduled_at FROM appointments WHERE status='scheduled' LIMIT 1",
      );
      assert.ok(current);
      assert.equal(
        (
          await req(
            "/operations/appointments/" + current.id,
            admin.cookie,
            { scheduledAt: current.scheduled_at, status: "confirmed" },
            "PUT",
          )
        ).status,
        200,
      );
      await app.db.prepare("UPDATE appointments SET status='completed' WHERE id=?").run(current.id);
      assert.equal(
        (
          await req(
            "/operations/appointments/" + current.id,
            admin.cookie,
            { scheduledAt: current.scheduled_at, status: "scheduled" },
            "PUT",
          )
        ).status,
        409,
      );
    } finally {
      await app.close();
    }
  },
);
