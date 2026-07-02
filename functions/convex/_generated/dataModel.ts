/**
 * Stub data model. Regenerate with `bun run codegen` after linking a Convex deployment.
 */
import type { DataModelFromSchemaDefinition } from 'convex/server'
import type schema from '../schema'

export type DataModel = DataModelFromSchemaDefinition<typeof schema>
export type Doc<T extends keyof DataModel> = DataModel[T]['document']
