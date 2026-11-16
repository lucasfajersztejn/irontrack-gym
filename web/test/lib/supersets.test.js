import { describe, it, expect } from 'vitest'
import { groupEntries, mergeWithNext, unmergeAt } from '../../src/lib/supersets.js'

const e = (name, groupId) => (groupId === undefined ? { name } : { name, groupId })

describe('groupEntries', () => {
  it('returns no blocks for no entries', () => {
    expect(groupEntries([])).toEqual([])
  })

  it('keeps ungrouped entries as single blocks', () => {
    const blocks = groupEntries([e('a'), e('b')])
    expect(blocks).toHaveLength(2)
    expect(blocks[0].groupId).toBeNull()
  })

  it('groups adjacent entries sharing a groupId with original indexes', () => {
    const blocks = groupEntries([e('a'), e('b', 'g'), e('c', 'g'), e('d')])
    expect(blocks).toHaveLength(3)
    expect(blocks[1].items.map((i) => i.index)).toEqual([1, 2])
  })

  it('does not merge non-adjacent entries with the same groupId', () => {
    expect(groupEntries([e('a', 'g'), e('b'), e('c', 'g')])).toHaveLength(3)
  })
})

describe('mergeWithNext', () => {
  it('assigns the same new groupId to both entries', () => {
    const out = mergeWithNext([e('a'), e('b'), e('c')], 0)
    expect(out[0].groupId).toBeTruthy()
    expect(out[0].groupId).toBe(out[1].groupId)
    expect(out[2].groupId).toBeUndefined()
  })

  it('reuses an existing groupId', () => {
    const out = mergeWithNext([e('a', 'g'), e('b')], 0)
    expect(out.map((x) => x.groupId)).toEqual(['g', 'g'])
  })

  it('does not mutate the input', () => {
    const input = [e('a'), e('b')]
    mergeWithNext(input, 0)
    expect(input[0].groupId).toBeUndefined()
  })

  it('returns the same entries for out-of-range indexes', () => {
    const input = [e('a'), e('b')]
    expect(mergeWithNext(input, 1)).toBe(input)
    expect(mergeWithNext(input, -1)).toBe(input)
  })
})

describe('unmergeAt', () => {
  it('dissolves a pair when one member leaves', () => {
    const out = unmergeAt([e('a', 'g'), e('b', 'g')], 0)
    expect(out.map((x) => x.groupId)).toEqual([null, null])
  })

  it('keeps the rest of a larger group', () => {
    const out = unmergeAt([e('a', 'g'), e('b', 'g'), e('c', 'g')], 1)
    expect(out.map((x) => x.groupId)).toEqual(['g', null, 'g'])
  })

  it('returns the same entries when the target is not grouped or out of range', () => {
    const input = [e('a'), e('b', 'g')]
    expect(unmergeAt(input, 0)).toBe(input)
    expect(unmergeAt(input, 5)).toBe(input)
  })
})
