"use server";

import { auth } from "~/auth";
import { db } from "~/server/db";
import { users } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "~/lib/encryption";

export async function saveAnthropicKey(
  apiKey: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const encrypted = encrypt(apiKey);
    await db
      .update(users)
      .set({ encryptedAnthropicKey: encrypted })
      .where(eq(users.id, session.user.id));
    return { success: true };
  } catch (error) {
    console.error("Error saving Anthropic key:", error);
    return { success: false, error: "Failed to save key" };
  }
}

export async function saveGithubPat(
  pat: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    return { success: false, error: "Not authenticated" };
  }

  try {
    const encrypted = encrypt(pat);
    await db
      .update(users)
      .set({ encryptedGithubPat: encrypted })
      .where(eq(users.id, session.user.id));
    return { success: true };
  } catch (error) {
    console.error("Error saving GitHub PAT:", error);
    return { success: false, error: "Failed to save token" };
  }
}

export async function getAnthropicKey(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const result = await db
      .select({ encryptedAnthropicKey: users.encryptedAnthropicKey })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const encrypted = result[0]?.encryptedAnthropicKey;
    if (!encrypted) return null;
    return decrypt(encrypted);
  } catch (error) {
    console.error("Error retrieving Anthropic key:", error);
    return null;
  }
}

export async function getGithubPat(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  try {
    const result = await db
      .select({ encryptedGithubPat: users.encryptedGithubPat })
      .from(users)
      .where(eq(users.id, session.user.id))
      .limit(1);

    const encrypted = result[0]?.encryptedGithubPat;
    if (!encrypted) return null;
    return decrypt(encrypted);
  } catch (error) {
    console.error("Error retrieving GitHub PAT:", error);
    return null;
  }
}

export async function clearAnthropicKey(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await db
    .update(users)
    .set({ encryptedAnthropicKey: null })
    .where(eq(users.id, session.user.id));
  return { success: true };
}

export async function clearGithubPat(): Promise<{ success: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { success: false };

  await db
    .update(users)
    .set({ encryptedGithubPat: null })
    .where(eq(users.id, session.user.id));
  return { success: true };
}
