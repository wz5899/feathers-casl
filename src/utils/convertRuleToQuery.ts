import _isPlainObject from 'lodash/isPlainObject.js'

import type { SubjectRawRule, MongoQuery, ClaimRawRule } from '@casl/ability'
import type { Query } from '@feathersjs/feathers'
import type { GetConditionalQueryOptions } from '../types.js'

const invertedMap = {
  $gt: '$lte',
  $gte: '$lt',
  $lt: '$gte',
  $lte: '$gt',
  $in: '$nin',
  $nin: '$in',
  $ne: (prop: Record<string, unknown>): unknown => {
    return prop['$ne']
  },
}

const supportedOperators = Object.keys(invertedMap)

const invertedProp = (
  prop: Record<string, unknown>,
  name: string,
): Record<string, unknown> | string | undefined => {
  // @ts-expect-error `name` maybe is not in `invertedMap`
  const map = invertedMap[name]
  if (typeof map === 'string') {
    return { [map]: prop[name] }
  } else if (typeof map === 'function') {
    return map(prop)
  }
}

export const convertRuleToQuery = (
  rule: SubjectRawRule<any, any, MongoQuery> | ClaimRawRule<any>,
  options?: GetConditionalQueryOptions,
): Query | undefined => {
  const { conditions, inverted } = rule
  if (!conditions) {
    if (inverted && options?.actionOnForbidden) {
      options.actionOnForbidden()
    }
    return undefined
  }
  if (inverted) {
    const newConditions = {} as Query
    for (const prop in conditions as Record<string, unknown>) {
      if (_isPlainObject(conditions[prop])) {
        const obj: any = conditions[prop]
        for (const name in obj) {
          if (!supportedOperators.includes(name)) {
            console.error(`CASL: not supported property: ${name}`)
            continue
          }
          newConditions[prop] = invertedProp(obj, name)
        }
      } else {
        newConditions[prop] = { $ne: conditions[prop] }
      }
    }

    return newConditions
  } else {
    return conditions as Query
  }
}
