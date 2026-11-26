// Preview overlay: the release sheet trims Ant's display reset to `[hidden]{display:none!important}`.
// Unscoped it hides .app-shell (modal portals add :last-child to body), so scope it to overlay holders.
const PREVIEW_STYLE = `
.app-shell[hidden] { display: flex !important; }
.ant-modal-wrap[hidden], .ant-select-dropdown[hidden], .ant-tooltip[hidden], .ant-layout-sider[hidden] { display: none !important; }
`
export function installPreviewStyles() {
  const style = document.createElement('style')
  style.id = 'ams-preview-overlay'
  style.textContent = PREVIEW_STYLE
  document.head.appendChild(style)
}
