import { Transform } from "stream"

import { compose, transformData } from "oleoduc"
import streamJson from "stream-json"
// eslint-disable-next-line import/extensions
import jsonFilters from "stream-json/filters/Pick.js"
// eslint-disable-next-line import/extensions
import streamers from "stream-json/streamers/StreamArray.js"

export function streamNestedJsonArray(arrayPropertyName) {
  return compose(
    streamJson.parser(),
    jsonFilters.pick({ filter: arrayPropertyName }),
    streamers.streamArray(),
    transformData((data) => data.value)
  )
}

export function streamJsonArray() {
  return compose(
    streamJson.parser(),
    streamers.streamArray(),
    transformData((data) => data.value)
  )
}

export const streamGroupByCount = (count: number) => {
  let group: any[] = []
  return new Transform({
    objectMode: true,
    transform(chunk, _encoding, callback) {
      group.push(chunk)
      if (group.length === count) {
        this.push(group)
        group = []
      }
      callback()
    },
    flush(callback) {
      if (group.length > 0) {
        this.push(group)
      }
      callback()
    },
  })
}
