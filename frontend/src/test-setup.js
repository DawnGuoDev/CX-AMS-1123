import { afterEach, vi } from 'vitest'
import { enableAutoUnmount } from '@vue/test-utils'
// jsdom has no layout engine. Ant's responsive tables observe sizes and media queries.
Object.defineProperty(window, 'matchMedia', { writable: true, value: vi.fn(query => ({
  matches: false, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false },
})) })
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
const getComputedStyle = window.getComputedStyle
window.getComputedStyle = element => getComputedStyle(element)
enableAutoUnmount(afterEach)
