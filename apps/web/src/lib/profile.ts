import 'server-only';
import { eq } from 'drizzle-orm';
import { db, users } from '@vivy/db';
import { DEFAULT_ACCENT_COLOUR, validAccentColour } from './profile-shared';

export interface UserProfile {
  email: string;
  displayName: string | null;
  accentColour: string;
}

export async function profileOf(userId: string): Promise<UserProfile> {
  const [profile] = await db()
    .select({
      email: users.email,
      displayName: users.displayName,
      accentColour: users.accentColour,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!profile) throw new Error('User not found.');
  return {
    ...profile,
    accentColour: validAccentColour(profile.accentColour)
      ? profile.accentColour
      : DEFAULT_ACCENT_COLOUR,
  };
}

export async function updateDisplayName(userId: string, value: string): Promise<void> {
  const displayName = value.trim();
  if (!displayName) throw new Error('Enter your name.');
  if (displayName.length > 60) throw new Error('Keep your name under 60 characters.');
  await db().update(users).set({ displayName }).where(eq(users.id, userId));
}

export async function updateAccentColour(userId: string, accentColour: string): Promise<void> {
  if (!validAccentColour(accentColour)) throw new Error('Choose an available accent colour.');
  await db().update(users).set({ accentColour }).where(eq(users.id, userId));
}
