/**
 * @vivy/core - the shared contract.
 *
 * Everything that crosses a process boundary in Vivy is defined here: the raw
 * record collectors write, the events derived from them, the sync protocol, and
 * the metric streams the charts read.
 *
 * The point of concentrating it in one package is that a schema change becomes a
 * compile error in the web app, the extension, the daemon and the Android schema
 * generator simultaneously - rather than silent data corruption in whichever one
 * you forgot.
 */

export * from './events/index';
export * from './raw';
export * from './sync/protocol';
export * from './streams';
export * from './ids';
export * from './time';

export * from './sources';
export * from './invite-code';
