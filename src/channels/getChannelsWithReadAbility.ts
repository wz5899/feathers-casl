import _isEqual from 'lodash/isEqual.js'
import _pick from 'lodash/pick.js'
import _isEmpty from 'lodash/isEmpty.js'
import { Channel } from '@feathersjs/transport-commons'
import { subject } from '@casl/ability'

import {
  makeChannelOptions,
  getAbility,
  getEventName,
} from './channels.utils.js'

import { getModelName, getAvailableFields } from '../utils/index.js'
import { hasRestrictingFields } from '../utils/hasRestrictingFields.js'

import type { RealTimeConnection } from '@feathersjs/transport-commons'

interface ConnectionsPerField {
  fields: false | string[]
  connections: RealTimeConnection[]
}

import type { HookContext, Application } from '@feathersjs/feathers'
import type { ChannelOptions, AnyData } from '../types.js'

export const getChannelsWithReadAbility = (
  app: Application,
  data: AnyData,
  context: HookContext,
  _options?: Partial<ChannelOptions>,
): undefined | Channel | Channel[] => {
  if (!_options?.channels && !app.channels.length) {
    return undefined
  }

  const options = makeChannelOptions(app, _options)
  const { channelOnError, activated } = options
  const modelName = getModelName(options.modelName, context)

  if (!activated || !modelName) {
    return !channelOnError ? new Channel() : app.channel(channelOnError)
  }

  let channels = options.channels || app.channel(app.channels)

  if (!Array.isArray(channels)) {
    channels = [channels]
  }

  const dataToTest = subject(modelName, data)

  let method = 'get'

  if (typeof options.useActionName === 'string') {
    method = options.useActionName
  } else {
    const eventName = getEventName(context.method)
    if (eventName && options.useActionName[eventName]) {
      method = options.useActionName[eventName] as string
    }
  }

  let result: Channel[] = []

  if (!options.restrictFields) {
    // return all fields for allowed

    result = channels.map((channel) => {
      return channel.filter((conn: any) => {
        const ability = getAbility(app, data, conn, context, options)
        const can = !!ability && ability.can(method, dataToTest)
        return can
      })
    })
  } else {
    // filter by restricted Fields
    const connectionsPerFields: ConnectionsPerField[] = []

    for (let i = 0, n = channels.length; i < n; i++) {
      const channel = channels[i]
      const { connections } = channel

      for (let j = 0, o = connections.length; j < o; j++) {
        const connection = connections[j]
        const { ability } = connection
        if (!ability || !ability.can(method, dataToTest)) {
          // connection cannot read item -> don't send data
          continue
        }
        const availableFields = getAvailableFields(context, options)

        const fields = hasRestrictingFields(ability, method, dataToTest, {
          availableFields,
        })
        // if fields is true or fields is empty array -> full restriction
        if (fields && (fields === true || fields.length === 0)) {
          continue
        }
        const connField = connectionsPerFields.find((x) =>
          _isEqual(x.fields, fields),
        )
        if (connField) {
          if (connField.connections.indexOf(connection) !== -1) {
            // connection is already in array -> skip
            continue
          }
          connField.connections.push(connection)
        } else {
          connectionsPerFields.push({
            connections: [connection],
            fields: fields as string[] | false,
          })
        }
      }
    }

    for (let i = 0, n = connectionsPerFields.length; i < n; i++) {
      const { fields, connections } = connectionsPerFields[i]
      const restrictedData = fields ? _pick(data, fields) : data
      if (!_isEmpty(restrictedData)) {
        result.push(new Channel(connections, restrictedData))
      }
    }
  }

  return result.length === 1 ? result[0] : result
}
