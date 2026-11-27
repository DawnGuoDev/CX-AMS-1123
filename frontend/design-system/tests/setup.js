// jsdom lacks the browser APIs Ant Design Vue's responsive observer and scrollbar probe use.
window.matchMedia = window.matchMedia || (query => ({
  matches: false, media: query, onchange: null,
  addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false,
}))
window.ResizeObserver = window.ResizeObserver || class { observe() {} unobserve() {} disconnect() {} }
window.getComputedStyle = element => ({
  getPropertyValue: () => '',
  width: '0px', height: '0px', overflow: 'hidden', overflowX: 'hidden', overflowY: 'hidden',
  position: 'static', display: 'block', visibility: 'visible', pointerEvents: 'auto', appearance: 'none',
  borderWidth: '0px', borderStyle: 'none', marginTop: '0px', marginBottom: '0px', paddingTop: '0px', paddingBottom: '0px',
})
globalThis.structuredClone = globalThis.structuredClone || (value => JSON.parse(JSON.stringify(value)))
