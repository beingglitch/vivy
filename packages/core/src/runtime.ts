/**
 * Zero-dependency runtime helpers.
 *
 * Collectors need `dedupeKey`, `localDateOf` and friends at runtime but only
 * need the event shapes as *types* - and types erase at compile time. Importing
 * them from the main barrel drags zod's validator into the bundle, which costs a
 * content script ~95 kB it will never execute.
 *
 * So: helpers here, schemas in the barrel. Collectors do
 *
 *   import { dedupeKey } from '@vivy/core/runtime';
 *   import type { VivyEvent } from '@vivy/core';
 *
 * and ship neither zod nor a validation path they do not use. The server, which
 * genuinely must validate untrusted input, imports the barrel.
 */

export * from './ids';
export * from './time';
