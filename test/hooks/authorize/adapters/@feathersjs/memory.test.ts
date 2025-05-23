import { MemoryService } from '@feathersjs/memory'
import { filterArray } from 'feathers-utils'
import type { Adapter, ServiceCaslOptions } from '../../../../../src/index.js'
import makeTests from '../makeTests/index.js'

declare module '@feathersjs/memory' {
  interface MemoryServiceOptions {
    casl?: ServiceCaslOptions
  }
}

const makeService = () => {
  const service = new MemoryService({
    multi: true,
    filters: {
      ...filterArray('$nor'),
    },
    operators: ['$nor'],
    casl: {
      availableFields: [
        'id',
        'userId',
        'hi',
        'test',
        'published',
        'supersecret',
        'hidden',
      ],
    },
    paginate: {
      default: 10,
      max: 50,
    },
  })

  return service
}

const adapter: Adapter = '@feathersjs/memory'

makeTests(
  adapter,
  makeService,
  async (app, service) => {
    await service.remove(null)
  },
  { adapter: adapter },
)
