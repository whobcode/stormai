/* eslint-disable @typescript-eslint/no-unused-vars */
import type { Env } from "../types";

/** Row shape exactly mirrors the users table */
export interface User {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  aiPurpose: string | null;
  dob: string | null;
  favoriteColor: string | null;
  favoriteAnimal: string | null;
  stylePrefs: string | null;
  created_at: string;               // ISO date string
}

export class D1Service {
  constructor(private db: D1Database) {}

  /** Insert a new user and return the rowid */
  async createUser(u: Omit<User, "id" | "created_at">): Promise<number> {
    const stmt = this.db.prepare(
      `INSERT INTO users
         (firstName,lastName,email,phone,aiPurpose,dob,
          favoriteColor,favoriteAnimal,stylePrefs)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)`
    );
    const { success, error, lastRowId } = await stmt
      .bind(
        u.firstName, u.lastName, u.email.toLowerCase(),
        u.phone ?? null, u.aiPurpose ?? null, u.dob ?? null,
        u.favoriteColor ?? null, u.favoriteAnimal ?? null,
        u.stylePrefs ?? null,
      )
      .run();
    if (!success) throw new Error(error);
    return Number(lastRowId);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const { results } = await this.db
      .prepare("SELECT * FROM users WHERE email = ?1 LIMIT 1")
      .bind(email.toLowerCase())
      .all<User>();
    return results[0] ?? null;
  }

  // TODO: ✨ add more helpers as needed (updateUser, listUsers, etc.)
}

