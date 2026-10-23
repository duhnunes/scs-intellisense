import type { SchemaFileContent } from '../interfaces/schemas'
import type { SiiDocument, SiiUnit } from '../interfaces/structure'

/**
 * A .sui of bare attributes is a unit body fragment: `@include` pastes it
 * into a unit, whose class is in another file. Given that class (the
 * workspace index finds it: `classesOf()`), the fragment is shown to
 * completion, hover and the schema rules as the body of a unit of that
 * class, so they need no special case.
 *
 * A fragment included by units of different classes gets them all,
 * joined by "|": its schema is the union of theirs (mergeSchemas()), so a
 * key is unknown only when no class has it.
 */

export const CLASS_SEPARATOR = '|'

/** The class name the fragment's virtual unit gets, or undefined when no
 *  unit includes it. */
export function fragmentClassName(classes: string[]): string | undefined {
  const unique = [...new Set(classes)].sort()
  return unique.length > 0 ? unique.join(CLASS_SEPARATOR) : undefined
}

/**
 * The document with its bare attributes in a nameless, headerless unit of
 * `className`. Only for the features that need a class: the structure
 * rules, highlighting and Outline keep the document as read.
 */
export function asFragmentDocument(
  document: SiiDocument,
  className: string | undefined
): SiiDocument {
  if (!className || document.units.length > 0) return document
  if (document.attributes.length === 0) return document
  const start = { start: 0, end: 0 }
  const unit: SiiUnit = {
    kind: 'unit',
    className,
    unitName: '',
    range: { start: 0, end: document.text.length },
    classNameRange: start,
    namespaceRange: undefined,
    colonRange: start,
    unitNameRange: start,
    bodyRange: { start: 0, end: document.text.length },
    attributes: document.attributes,
  }
  return { ...document, units: [unit], attributes: [] }
}

/** Looks up each class of a "|"-joined name and merges their schemas. */
export function lookupClasses(
  className: string,
  lookup: (className: string) => SchemaFileContent | undefined
): SchemaFileContent | undefined {
  if (!className.includes(CLASS_SEPARATOR)) return lookup(className)
  return mergeSchemas(className.split(CLASS_SEPARATOR).map(lookup))
}

/** The async form of lookupClasses(). */
export async function lookupClassesAsync(
  className: string,
  lookup: (className: string) => Promise<SchemaFileContent | undefined>
): Promise<SchemaFileContent | undefined> {
  if (!className.includes(CLASS_SEPARATOR)) return lookup(className)
  return mergeSchemas(
    await Promise.all(className.split(CLASS_SEPARATOR).map(lookup))
  )
}

/**
 * One schema with every key of `schemas`; an enum key in several of them
 * accepts the values of all. Undefined while any is still missing: a
 * partial union would report keys of the missing class as unknown.
 */
export function mergeSchemas(
  schemas: (SchemaFileContent | undefined)[]
): SchemaFileContent | undefined {
  if (schemas.length === 0 || schemas.some((schema) => !schema?.key))
    return undefined
  const [first, ...rest] = schemas as SchemaFileContent[]
  const key = { ...first!.key }
  for (const schema of rest)
    for (const [name, def] of Object.entries(schema.key)) {
      const existing = key[name]
      if (!existing) key[name] = def
      else if (Array.isArray(existing.values) && Array.isArray(def.values))
        key[name] = {
          ...existing,
          values: [...new Set([...existing.values, ...def.values])],
        }
    }
  return { ...first!, key }
}
