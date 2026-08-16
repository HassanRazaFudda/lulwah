import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger.js';

const HEADER = 'x-request-id';

/**
 * Reads `x-request-id` if the caller sent one (useful when the storefront
 * BFF or an upstream proxy already minted one), otherwise generates one.
 * Echoed back on the response header and on every envelope (`§9.1`), and
 * bound onto a per-request child logger so every log line for this
 * request — and any future Sentry event — carries it (plan.md §9.8).
 */
export function requestId() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const incoming = req.header(HEADER);
    const id = incoming && incoming.length > 0 ? incoming : `req_${randomUUID()}`;
    req.id = id;
    req.log = logger.child({ requestId: id });
    res.setHeader(HEADER, id);
    next();
  };
}
