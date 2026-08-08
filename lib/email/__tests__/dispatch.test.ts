/**
 * @jest-environment node
 *
 * jsdom não expõe `TextEncoder` globalmente, e o SDK da Resend (via
 * postal-mime) o usa no carregamento do módulo. `chunk` é síncrona e pura —
 * não depende de DOM —, então basta rodar este arquivo no ambiente node.
 */
import { chunk } from '../dispatch'

describe('chunk', () => {
  it('splits into exact groups', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('leaves the remainder in the last group', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('handles a group larger than the list', () => {
    expect(chunk([1, 2], 100)).toEqual([[1, 2]])
  })

  it('returns empty for an empty list', () => {
    expect(chunk([], 10)).toEqual([])
  })

  it('never produces empty groups', () => {
    for (const size of [1, 2, 3, 7]) {
      const groups = chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], size)
      expect(groups.every((g) => g.length > 0)).toBe(true)
      expect(groups.flat()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
      expect(groups.every((g) => g.length <= size)).toBe(true)
    }
  })

  it('throws on a non-positive size', () => {
    expect(() => chunk([1], 0)).toThrow()
    expect(() => chunk([1], -1)).toThrow()
  })
})
