import assert from 'node:assert'
import { feathers } from '@feathersjs/feathers'
import { defineAbility } from '@casl/ability'
import _sortBy from 'lodash/sortBy.js'

import type { Application } from '@feathersjs/feathers'

import { authorize } from '../../../../../src/index.js'
import type { Adapter, AuthorizeHookOptions } from '../../../../../src/index.js'
import { resolveAction } from '../../../../test-utils.js'
import type { MakeTestsOptions } from './_makeTests.types.js'

export default (
  adapterName: Adapter | string,
  makeService: () => any,
  clean: (app, service) => Promise<void>,
  authorizeHookOptions: Partial<AuthorizeHookOptions>,
  { around, afterHooks }: MakeTestsOptions = { around: false, afterHooks: [] },
): void => {
  let app: Application
  let service
  let id

  // const itSkip = (adapterToTest: string | string[]) => {
  //   const condition =
  //     typeof adapterToTest === "string"
  //       ? adapterName === adapterToTest
  //       : adapterToTest.includes(adapterName);
  //   return condition ? it.skip : it;
  // };

  describe(`${adapterName}: beforeAndAfter - create:multi`, function () {
    beforeEach(async function () {
      app = feathers()
      app.use('tests', makeService())
      service = app.service('tests')

      id = service.options.id

      const options = Object.assign(
        {
          availableFields: [
            id,
            'userId',
            'hi',
            'test',
            'published',
            'supersecret',
            'hidden',
          ],
        },
        authorizeHookOptions,
      )

      afterHooks = Array.isArray(afterHooks)
        ? afterHooks
        : afterHooks
          ? [afterHooks]
          : []

      if (around) {
        service.hooks({
          around: {
            all: [authorize(options)],
          },
          before: {},
          after: {
            all: afterHooks,
          },
        })
      } else {
        service.hooks({
          before: {
            all: [authorize(options)],
          },
          after: {
            all: [...afterHooks, authorize(options)],
          },
        })
      }

      await clean(app, service)
    })

    it('can create multiple items and returns empty array', async function () {
      const allItems = (await service.find({ paginate: false })) as unknown[]
      assert.strictEqual(allItems.length, 0, 'has no items before')

      const itemsArr = [
        { test: true, hi: '1', userId: 1 },
        { test: true, hi: '2', userId: 1 },
        { test: true, hi: '3', userId: 1 },
      ]
      const items = await service.create(itemsArr, {
        ability: defineAbility(
          (can) => {
            can('create', 'tests', { userId: 1 })
          },
          { resolveAction },
        ),
      })

      assert.strictEqual(items.length, 0, 'array is empty')
    })

    it('can create multiple items and returns all items', async function () {
      const readMethods = ['read', 'find']
      for (const read of readMethods) {
        await clean(app, service)
        const allItems = (await service.find({ paginate: false })) as unknown[]
        assert.strictEqual(
          allItems.length,
          0,
          `has no items before for read: '${read}'`,
        )
        const itemsArr = [
          { test: true, hi: '1', userId: 1 },
          { test: true, hi: '2', userId: 1 },
          { test: true, hi: '3', userId: 1 },
        ]
        const items = await service.create(itemsArr, {
          ability: defineAbility(
            (can) => {
              can('create', 'tests', { userId: 1 })
              can(read, 'tests')
            },
            { resolveAction },
          ),
        })

        const expectedItems = (await service.find({
          paginate: false,
        })) as Record<string, unknown>[]

        assert.deepStrictEqual(
          _sortBy(items, id),
          _sortBy(expectedItems, id),
          `created items for read: '${read}'`,
        )
      }
    })

    it("rejects if one item can't be created", async function () {
      const itemsArr = [
        { test: true, hi: '1', userId: 1 },
        { test: true, hi: '2', userId: 2 },
        { test: true, hi: '3', userId: 1 },
      ]
      const promise = service.create(itemsArr, {
        ability: defineAbility(
          (can) => {
            can('create', 'tests', { userId: 1 })
          },
          { resolveAction },
        ),
      })

      await assert.rejects(
        promise,
        (err: Error) => err.name === 'Forbidden',
        'rejects because different userId',
      )
    })

    it('picks properties for fields for multiple created data', async function () {
      const itemsArr = [
        { test: true, hi: '1', userId: 1 },
        { test: true, hi: '2', userId: 2 },
        { test: true, hi: '3', userId: 1 },
      ]
      const items = await service.create(itemsArr, {
        ability: defineAbility(
          (can) => {
            can('create', 'tests')
            can('read', 'tests')
            can('read', 'tests', [id], { userId: 2 })
            can('read', 'tests', [id, 'userId'], { hi: '3' })
          },
          { resolveAction },
        ),
      })

      const expected = [
        { [id]: items[0][id], test: true, hi: '1', userId: 1 },
        { [id]: items[1][id] },
        { [id]: items[2][id], userId: 1 },
      ]

      assert.deepStrictEqual(items, expected, 'filtered properties')
    })
  })
}
