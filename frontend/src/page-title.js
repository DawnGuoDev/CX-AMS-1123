/**
 * Page heading resolution for Workspace.vue.
 *
 * Report pages (AVPA004/007/008/013) are routed through ReportPage and have no
 * master definition, so their heading must come from meta.pageTitles. Missing a
 * key here silently degrades the heading to "页面不存在" (the page itself still
 * renders), which is why the fallback list and the metadata file are kept in sync
 * and covered by tests.
 */
const BUILTIN_TITLES = { HOME: '即时警报汇总', ACK: '邮件警报确认' }

export function pageTitle(code, master, pageTitles) {
  if (master?.title) return master.title
  if (pageTitles?.[code]) return pageTitles[code]
  return BUILTIN_TITLES[code] || '页面不存在'
}
