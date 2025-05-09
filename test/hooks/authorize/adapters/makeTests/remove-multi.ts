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

  describe(`${adapterName}: beforeAndAfter - remove:multiple`, function () {
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
            all: [...afterHooks],
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

    it('can remove multiple items and returns [] for not allowed read', async function () {
      const item1 = await service.create({ test: true, userId: 1 })

      const item2 = await service.create({ test: true, userId: 1 })
      const item3 = await service.create({ test: true, userId: 2 })

      const removedItems = await service.remove(null, {
        ability: defineAbility(
          (can) => {
            can('remove', 'tests')
          },
          { resolveAction },
        ),
        query: {
          userId: 1,
        },
      })

      assert.deepStrictEqual(removedItems, [], 'result is empty array')

      const realItems = await service.find({ paginate: false })
      const expected = [{ [id]: item3[id], test: true, userId: 2 }]
      assert.deepStrictEqual(realItems, expected, 'removed items correctly')
    })

    it('can remove multiple items and returns result', async function () {
      const readMethods = ['read', 'find']

      for (const read of readMethods) {
        await clean(app, service)
        const item1 = await service.create({ test: true, userId: 1 })
        const item2 = await service.create({ test: true, userId: 1 })
        const item3 = await service.create({ test: true, userId: 2 })

        const removedItems = await service.remove(null, {
          ability: defineAbility(
            (can) => {
              can('remove', 'tests')
              can(read, 'tests')
            },
            { resolveAction },
          ),
          query: {
            userId: 1,
          },
        })

        const expectedResult = [
          { [id]: item1[id], test: true, userId: 1 },
          { [id]: item2[id], test: true, userId: 1 },
        ]

        assert.deepStrictEqual(
          _sortBy(removedItems, id),
          _sortBy(expectedResult, id),
          `result is right array for read: '${read}'`,
        )

        const realItems = await service.find({ paginate: false })
        const expected = [{ [id]: item3[id], test: true, userId: 2 }]
        assert.deepStrictEqual(
          realItems,
          expected,
          `removed items correctly for read: '${read}'`,
        )
      }
    })

    it('removes only allowed items', async function () {
      const item1 = await service.create({ test: true, userId: 1 })
      const item2 = await service.create({ test: true, userId: 1 })
      const item3 = await service.create({ test: true, userId: 2 })

      const removedItems = await service.remove(null, {
        ability: defineAbility(
          (can) => {
            can('remove', 'tests', { userId: 1 })
            can('read', 'tests')
          },
          { resolveAction },
        ),
        query: {},
      })

      const expectedResult = [
        { [id]: item1[id], test: true, userId: 1 },
        { [id]: item2[id], test: true, userId: 1 },
      ]

      assert.deepStrictEqual(
        _sortBy(removedItems, id),
        _sortBy(expectedResult, id),
        'result is right array',
      )

      const realItems = await service.find({ paginate: false })
      const expected = [{ [id]: item3[id], test: true, userId: 2 }]
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        'removed items correctly',
      )
    })

    it('removes allowed items and returns subset for read', async function () {
      await service.create({ published: false, test: true, userId: 1 })
      const item2 = await service.create({
        published: true,
        test: true,
        userId: 1,
      })
      const item3 = await service.create({
        published: true,
        test: true,
        userId: 2,
      })
      const item4 = await service.create({
        published: true,
        test: true,
        userId: 2,
      })
      const item5 = await service.create({
        published: false,
        test: true,
        userId: 2,
      })

      const removedItems = await service.remove(null, {
        ability: defineAbility(
          (can) => {
            can('remove', 'tests', { userId: 1 })
            can('read', 'tests', { published: true })
          },
          { resolveAction },
        ),
        query: {},
      })

      const expectedResult = [
        { [id]: item2[id], published: true, test: true, userId: 1 },
      ]

      assert.deepStrictEqual(
        removedItems,
        expectedResult,
        'result is right array',
      )

      const realItems = await service.find({ paginate: false })
      const expected = [
        { [id]: item3[id], published: true, test: true, userId: 2 },
        { [id]: item4[id], published: true, test: true, userId: 2 },
        { [id]: item5[id], published: false, test: true, userId: 2 },
      ]
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        'removed items correctly',
      )
    })

    it('removes allowed items and returns subset for read with restricted fields', async function () {
      let items = [
        { published: false, test: true, userId: 1 },
        { published: true, test: true, userId: 1 },
        { published: true, test: true, userId: 2 },
        { published: true, test: true, userId: 2 },
        { published: false, test: true, userId: 2 },
      ]
      items = await service.create(items)

      const removedItems = await service.remove(null, {
        ability: defineAbility(
          (can) => {
            can('remove', 'tests', { userId: 1 })
            can('read', 'tests', [id], { published: false })
            can('read', 'tests', { published: true })
          },
          { resolveAction },
        ),
      })

      const expectedResult = [
        { [id]: items[0][id] },
        { [id]: items[1][id], published: true, test: true, userId: 1 },
      ]

      assert.deepStrictEqual(
        _sortBy(removedItems, id),
        _sortBy(expectedResult, id),
        'result is right array',
      )

      const realItems = await service.find({ paginate: false })
      const expected = [
        { [id]: items[2][id], published: true, test: true, userId: 2 },
        { [id]: items[3][id], published: true, test: true, userId: 2 },
        { [id]: items[4][id], published: false, test: true, userId: 2 },
      ]
      assert.deepStrictEqual(
        _sortBy(realItems, id),
        _sortBy(expected, id),
        'removed items correctly',
      )
    })
  })
}
