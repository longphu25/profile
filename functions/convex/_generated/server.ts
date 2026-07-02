/**
 * Stub server wrappers. Regenerate with `bun run codegen` after `convex dev` links a deployment.
 */
import {
  httpActionGeneric,
  internalActionGeneric,
  internalMutationGeneric,
  queryGeneric,
} from 'convex/server'

export const query = queryGeneric
export const internalMutation = internalMutationGeneric
export const internalAction = internalActionGeneric
export const httpAction = httpActionGeneric
