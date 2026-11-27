<script setup>
/**
 * AMS data grid: search, per-column filters, sortable headers, selection, actions, tag mapping.
 * Density is fixed at Ant Design Vue `middle` + 20 rows/page, matching production.
 * No API, router or translations are required; labels come from `columns`.
 */
import { computed, ref, watch } from 'vue'

const props = defineProps({
  rows: { type: Array, default: () => [] },
  columns: { type: Array, default: () => [] },
  selectable: Boolean,
  rowKey: { type: String, default: '' },
  pageSize: { type: Number, default: 20 },
  searchPlaceholder: { type: String, default: '过滤' },
  pageSizeOptions: { type: Array, default: () => [20, 25, 50, 100, 200, 500] },
  emptyText: { type: String, default: '查无资料' },
  actionLabel: { type: String, default: '查看' },
  loading: Boolean,
})
const emit = defineEmits(['select', 'open', 'filtered'])
const search = ref(''), page = ref(1), size = ref(props.pageSize), selected = ref([]), sort = ref(''), descending = ref(false)
const columnFilters = ref({}), showFilters = ref(false)
const textOps = [['contains', '包含'], ['notContains', '不包含'], ['starts', '开头为'], ['ends', '结尾为'], ['eq', '等于'], ['neq', '不等于']]
const dateOps = [['between', '介于'], ['eq', '等于'], ['neq', '不等于'], ['lt', '小于'], ['lte', '小于等于'], ['gt', '大于'], ['gte', '大于等于']]
const columns = computed(() => props.columns.length ? props.columns : Object.keys(props.rows[0] || {}).slice(0, 10).map(field => ({ field, label: field })))
const isDate = c => c.type === 'date' || /(_DT|_DATE)$/.test(c.field || c.name || '')
const emptyFilter = c => ({ enabled: false, type: isDate(c) ? 'date' : 'text', operator: isDate(c) ? 'between' : 'contains', value: '', from: '', to: '' })
function matches(raw, c) {
  if (!c || !c.enabled || (!c.value && !c.from && !c.to)) return true
  if (c.type === 'date') {
    const seconds = v => Math.floor(new Date(v).getTime() / 1000)
    const a = seconds(raw), b = seconds(c.value)
    if (raw == null || raw === '' || !Number.isFinite(a)) return false
    return { between: () => (!c.from || a >= seconds(c.from)) && (!c.to || a <= seconds(c.to)), eq: () => a === b, neq: () => a !== b,
      lt: () => a < b, lte: () => a <= b, gt: () => a > b, gte: () => a >= b }[c.operator]?.() ?? false
  }
  const a = String(raw ?? '').toLowerCase(), b = c.value.toLowerCase()
  return { contains: () => a.includes(b), notContains: () => !a.includes(b), starts: () => a.startsWith(b), ends: () => a.endsWith(b),
    eq: () => a === b, neq: () => a !== b }[c.operator]?.() ?? false
}
const filtered = computed(() => {
  let rows = props.rows.filter(row => columns.value.some(c => String(row[c.field || c.name] ?? '').toLowerCase().includes(search.value.toLowerCase())))
  rows = rows.filter(row => Object.entries(columnFilters.value).every(([key, value]) => matches(row[key], value)))
  if (sort.value) rows = [...rows].sort((a, b) => String(a[sort.value] ?? '').localeCompare(String(b[sort.value] ?? ''), undefined, { numeric: true }) * (descending.value ? -1 : 1))
  return rows
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)))
watch(filtered, rows => { emit('filtered', rows); page.value = Math.min(page.value, pages.value) }, { immediate: true })
watch(() => columns.value.map(c => `${c.field || c.name}:${c.type}`).join('|'), () => {
  columnFilters.value = Object.fromEntries(columns.value.map(c => [c.field || c.name, emptyFilter(c)]))
}, { immediate: true })
defineExpose({ filtered })
const recordKey = row => props.rowKey ? row[props.rowKey] : props.rows.indexOf(row)
const tableColumns = computed(() => [...columns.value.map(col => ({
  ...col, key: col.field || col.name, dataIndex: col.field || col.name, title: col.label || col.field || col.name,
  customHeaderCell: () => ({ onClick: () => order(col), style: { cursor: 'pointer' } }),
})), { key: '__actions', title: '操作' }])
const rowSelection = computed(() => props.selectable ? {
  selectedRowKeys: selected.value.map(recordKey),
  onChange: (_keys, rows) => { selected.value = rows; emit('select', rows) },
  getCheckboxProps: () => ({ 'aria-label': '选择资料' }),
} : undefined)
const pagination = computed(() => ({ current: page.value, pageSize: size.value, total: filtered.value.length, showSizeChanger: true,
  pageSizeOptions: props.pageSizeOptions.map(String), showTotal: total => `共 ${total} 笔`,
  onChange: (next, nextSize) => { page.value = next; size.value = nextSize } }))
function tagColor(value) {
  if (['Completed', 'Success', 'OK', 'Y'].includes(value)) return 'success'
  if (['NoNextLevel', 'Fail', 'Error', 'NG'].includes(value)) return 'error'
  if (['Process', 'Unknown'].includes(value)) return 'warning'
  return 'default'
}
watch([search, size, () => props.rows], () => { page.value = 1; selected.value = []; emit('select', []) })
watch(columnFilters, () => { page.value = 1; selected.value = []; emit('select', []) }, { deep: true })
const STATUS_FIELDS = ['STATUS', 'ACTIVE', 'DEVICE_STATUS', 'AGENT_STATUS', 'RESULT']
function label(row, col) {
  const value = row[col.field || col.name]
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') return JSON.stringify(value)
  if (/^\d{4}-\d\d-\d\dT/.test(String(value))) return new Date(value).toLocaleString()
  return String(value)
}
function order(col) { const key = col.field || col.name; descending.value = sort.value === key ? !descending.value : false; sort.value = key }
</script>
<template>
  <div class="grid">
    <div class="grid-tools">
      <a-input v-model:value="search" :placeholder="searchPlaceholder" aria-label="过滤列表" style="width:220px"/>
      <a-button @click="showFilters = !showFilters">列过滤</a-button>
      <span>{{ filtered.length }} 笔资料</span><slot name="tools"/>
    </div>
    <div v-if="showFilters" class="column-filters">
      <div v-for="col in columns" :key="col.field || col.name" class="column-filter">
        <template v-if="columnFilters[col.field || col.name]">
          <span>{{ col.label || col.field || col.name }}</span>
          <a-select v-model:value="columnFilters[col.field || col.name].operator" :aria-label="`${col.label}运算`"
            :options="(isDate(col) ? dateOps : textOps).map(([value, label]) => ({ value, label }))"/>
          <template v-if="isDate(col) && columnFilters[col.field || col.name].operator === 'between'">
            <a-input v-for="bound in ['from', 'to']" :key="bound" type="datetime-local" step="1"
              v-model:value="columnFilters[col.field || col.name][bound]" @input="columnFilters[col.field || col.name].enabled = true"
              :aria-label="`${col.label}${bound === 'from' ? '起始' : '结束'}`"/>
          </template>
          <a-input v-else :type="isDate(col) ? 'datetime-local' : 'text'" step="1"
            v-model:value="columnFilters[col.field || col.name].value" @input="columnFilters[col.field || col.name].enabled = true" :aria-label="`过滤${col.label}`"/>
          <a-button @click="columnFilters[col.field || col.name] = emptyFilter(col)">重置本列</a-button>
        </template>
      </div>
      <a-button @click="columnFilters = Object.fromEntries(columns.map(c => [c.field || c.name, emptyFilter(c)]))">全部重置</a-button>
    </div>
    <a-table :columns="tableColumns" :data-source="filtered" :row-key="recordKey" :row-selection="rowSelection"
      :pagination="pagination" :scroll="{ x: 'max-content' }" size="middle" :loading="loading" :locale="{ emptyText }"
      :row-class-name="row => [selected.includes(row) ? 'selected' : '', row.ACTIVE === 'N' ? 'hidden' : ''].join(' ')">
      <template #headerCell="{ column }">
        {{ column.title }}<small v-if="sort === column.dataIndex"> {{ descending ? '↓' : '↑' }}</small>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === '__actions'">
          <a-button type="link" @click="emit('open', record)">{{ actionLabel }}</a-button><slot name="actions" :row="record"/>
        </template>
        <a-tag v-else-if="STATUS_FIELDS.includes(column.dataIndex)" class="tag" :color="tagColor(String(record[column.dataIndex]))">{{ label(record, column) }}</a-tag>
        <a-button v-else-if="column.link" type="link" @click="emit('open', record)">{{ label(record, column) }}</a-button>
        <span v-else :title="label(record, column)">{{ label(record, column) }}</span>
      </template>
    </a-table>
  </div>
</template>
<style scoped>
.column-filters {display:flex;flex-wrap:wrap;gap:16px;padding:16px;border-bottom:1px solid var(--border);align-items:end}
.column-filter {display:grid;gap:6px;width:190px}
</style>
