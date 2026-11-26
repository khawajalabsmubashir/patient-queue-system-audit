import { Router } from "express";
import type { Database } from "../db/database.ts";
import { randomUUID } from "node:crypto";
import { compare, hash, hashSync } from "bcryptjs";
import { z } from "zod";
import {
  validatePassword,
  validatePersonName,
  validatePhoneNumber,
} from "../../src/domain/input-validation.ts";
import { one, type UserRow } from "../db/database.ts";
import {
  ApiError,
  currentUser,
  startSession,
  endSession,
  publicUser,
  resolveUser,
} from "../middleware/auth.ts";

const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const MAX_IP_LOGIN_ATTEMPTS = 25;
const LOCK_WINDOW_MS = 15 * 60000;

const password = z.string().superRefine((val, ctx) => {
  const check = validatePassword(val, 8);
  if (!check.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error });
});

const emailSchema = z
  .string()
  .trim()
  .min(1, "Email is required.")
  .max(254)
  .email("Enter a valid email address.")
  .transform((s) => s.toLowerCase());

const credentials = z.object({
  email: emailSchema,
  password,
});

const loginCredentials = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required.").max(72),
  portal: z.enum(["patient", "staff"]).optional(),
});

const registration = credentials
  .extend({
    fullName: z
      .string()
      .superRefine((val, ctx) => {
        const check = validatePersonName(val, "Full name", { strictAllowlist: false });
        if (!check.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error });
      })
      .transform((val) => val.trim().replace(/\s+/g, " ")),
    phone: z
      .string()
      .superRefine((val, ctx) => {
        const check = validatePhoneNumber(val);
        if (!check.ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message: check.error });
      })
      .transform((val) => val.trim().replace(/\s+/g, " ")),
  })
  .strict();

const unusedHash = hashSync("unassigned-authentication-account", 12);

export function authRoutes(db: Database) {
  const routes = Router();
  const attempts = new Map<string, { count: number; until: number }>();

  routes.post("/register", async (req, res) => {
    const input = registration.parse(req.body);
    if (await one(db, "SELECT id FROM users WHERE email=?", input.email))
      throw new ApiError(
        409,
        "EMAIL_EXISTS",
        "An account already exists for this email. Please sign in.",
      );
    const id = randomUUID(),
      stamp = new Date().toISOString(),
      encoded = await hash(input.password, 12);
    // Recheck after asynchronous hashing; uniqueness also guards simultaneous registrations.
    if (await one(db, "SELECT id FROM users WHERE email=?", input.email))
      throw new ApiError(
        409,
        "EMAIL_EXISTS",
        "An account already exists for this email. Please sign in.",
      );
    try {
      await db
        .prepare("INSERT INTO users VALUES (?,?,?,?,?,?,?,?)")
        .run(id, input.fullName, input.email, input.phone, encoded, "patient", stamp, stamp);
    } catch (error) {
      if ((error as { code?: string }).code === "23505")
        throw new ApiError(
          409,
          "EMAIL_EXISTS",
          "An account already exists for this email. Please sign in.",
        );
      throw error;
    }
    await startSession(db, req, res, id);
    res.status(201).json({
      success: true,
      data: publicUser((await one<UserRow>(db, "SELECT * FROM users WHERE id=?", id))!),
    });
  });

  routes.post("/login", async (req, res) => {
    const input = loginCredentials.strict().parse(req.body),
      ip = req.ip ?? "local",
      ipKey = `ip:${ip}`,
      acctKey = `acct:${ip}:${input.email}`,
      now = Date.now(),
      priorIp = attempts.get(ipKey),
      priorAcct = attempts.get(acctKey);
    const ipState =
      priorIp && priorIp.until > now ? priorIp : { count: 0, until: now + LOCK_WINDOW_MS };
    const acctState =
      priorAcct && priorAcct.until > now ? priorAcct : { count: 0, until: now + LOCK_WINDOW_MS };

    if (acctState.count >= MAX_FAILED_LOGIN_ATTEMPTS || ipState.count >= MAX_IP_LOGIN_ATTEMPTS)
      throw new ApiError(
        429,
        "TOO_MANY_ATTEMPTS",
        "Too many failed login attempts. Your login is temporarily locked for 15 minutes. Please wait and try again.",
      );

    const recordFailure = () => {
      ipState.count++;
      acctState.count++;
      attempts.set(ipKey, ipState);
      attempts.set(acctKey, acctState);
      const remaining = MAX_FAILED_LOGIN_ATTEMPTS - acctState.count;
      if (remaining <= 0) {
        throw new ApiError(
          429,
          "TOO_MANY_ATTEMPTS",
          "Too many failed login attempts. Your login is temporarily locked for 15 minutes. Please wait and try again.",
        );
      }
      const hint =
        remaining <= 2
          ? ` ${remaining} attempt${remaining === 1 ? "" : "s"} remaining before a 15-minute temporary lock.`
          : "";
      throw new ApiError(401, "INVALID_CREDENTIALS", "The email or password is incorrect." + hint);
    };

    const user = await one<UserRow>(db, "SELECT * FROM users WHERE email=?", input.email);
    const matches = await compare(input.password, user?.password_hash ?? unusedHash);
    if (!user || !matches) recordFailure();
    const activeUser = await resolveUser(db, user!);
    if (!activeUser) recordFailure();

    const isStaff = ["admin", "receptionist", "nurse"].includes(activeUser!.role);
    if (
      input.portal &&
      ((input.portal === "patient" && activeUser!.role !== "patient") ||
        (input.portal === "staff" && !isStaff))
    ) {
      throw new ApiError(
        403,
        "WRONG_PORTAL",
        input.portal === "patient"
          ? "This is a clinic staff account. Please select Clinic staff."
          : "This is a patient account. Please select Patient.",
      );
    }

    await db
      .prepare("UPDATE staff_profiles SET last_activity_at=? WHERE user_id=?")
      .run(new Date().toISOString(), user!.id);
    attempts.delete(acctKey);
    attempts.delete(ipKey);
    await startSession(db, req, res, user!.id);
    res.json({ success: true, data: publicUser(activeUser!) });
  });

  routes.get("/me", async (req, res) => {
    const user = await currentUser(db, req);
    res.json({ success: true, data: user ? publicUser(user) : null });
  });

  routes.post("/logout", async (req, res) => {
    await endSession(db, req, res);
    res.json({ success: true, data: null });
  });

  return routes;
}
