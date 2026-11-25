<script setup>
import { computed, ref, watch } from 'vue'
import { Button as AButton, Input as AInput, Select as ASelect, Table as ATable, Tag as ATag } from 'ant-design-vue'
import { t, state } from '../state'
import { textOps,dateOps,emptyFilter,matches,isDate } from '../filters'
const props = defineProps({ rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] }, selectable: Boolean, rowKey: { type: String, default: '' }, clearSelectionOnRefresh: { type: Boolean, default: true } })
const emit = defineEmits(['select', 'open', 'filtered'])
const search = ref(''), page = ref(1), size = ref(20), selected = ref([]), sort = ref(''), descending = ref(false)
const columnFilters=ref({}),showFilters=ref(false)
const columns = computed(() => props.columns.length ? props.columns : Object.keys(props.rows[0] || {}).filter(k => k !== 'PASSWORD_HASH').slice(0, 10).map(field => ({ field, label: field })))
const filtered = computed(() => {
  let rows = props.rows.filter(row => columns.value.some(c => String(row[c.field || c.name] ?? '').toLowerCase().includes(search.value.toLowerCase())))
  rows=rows.filter(row=>Object.entries(columnFilters.value).every(([key,value])=>matches(row[key],value)))
  if (sort.value) rows = [...rows].sort((a, b) => String(a[sort.value] ?? '').localeCompare(String(b[sort.value] ?? ''), undefined, { numeric: true }) * (descending.value ? -1 : 1))
  return rows
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)))

watch(filtered,rows=>{emit('filtered',rows);page.value=Math.min(page.value,pages.value)},{immediate:true})
watch(()=>columns.value.map(c=>`${c.field||c.name}:${c.type}`).join('|'),()=>{
  columnFilters.value=Object.fromEntries(columns.value.map(c=>[c.field||c.name,emptyFilter(c)]))
},{immediate:true})
defineExpose({filtered})
const recordKey = row => props.rowKey ? row[props.rowKey] : props.rows.indexOf(row)
const tableColumns = computed(() => [...columns.value.map(col => ({
  ...col, key: col.field || col.name, dataIndex: col.field || col.name,
  title: t(col.label || col.field || col.name),
  customHeaderCell: () => ({ onClick: () => order(col), style: { cursor: 'pointer' } }),
})), { key: '__actions', title: t('操作') }])
const rowKeyOf = row => String(recordKey(row))
// 勾选状态始终以行对象保存；跨页/跨刷新时用 rowKey 去重合并，保证全选当前筛选结果与翻页保留。
const rowSelection = computed(() => props.selectable ? {
  selectedRowKeys: selected.value.map(rowKeyOf),
  preserveSelectedRowKeys: true,
  onChange: (_pageKeys, pageRows) => {
    if (!props.rowKey) { selected.value = pageRows; emit('select', selected.value); return }
    const currentKeys = new Set(filtered.value.map(rowKeyOf))
    const pickedKeys = new Set(pageRows.map(rowKeyOf))
    const kept = selected.value.filter(row => !currentKeys.has(rowKeyOf(row)))
    selected.value = [...kept, ...pageRows.filter(row => pickedKeys.has(rowKeyOf(row)))]
    emit('select', selected.value)
  },
  getCheckboxProps: () => ({ 'aria-label': '选择资料' }),
} : undefined)
const pagination = computed(() => ({ current: page.value, pageSize: size.value, total: filtered.value.length,
  showSizeChanger: true, pageSizeOptions: ['20','25','50','100','200','500'],
  onChange: (next, nextSize) => { page.value = next; size.value = nextSize },
}))
function tagColor(value) {
  if (['Completed','Success','OK','Y'].includes(value)) return 'success'
  if (['NoNextLevel','Fail','Error','NG'].includes(value)) return 'error'
  if (['Process','Unknown'].includes(value)) return 'warning'
  return 'default'
}
watch([search, size], () => { page.value = 1; selected.value = []; emit('select', []) })
watch(() => props.rows, () => { page.value = 1; if (props.clearSelectionOnRefresh) { selected.value = []; emit('select', []) } })
watch(columnFilters,()=>{page.value=1;selected.value=[];emit('select',[])},{deep:true})
function label(row, col) {
  const value = row[col.field || col.name]
  if (value === null || value === undefined || value === '') return '—'
  if (col.optionSet) return (state.options[col.optionSet] || []).find(o => o.value === value)?.label || value
  if (typeof value === 'object') return JSON.stringify(value)
  if (/^\d{4}-\d\d-\d\dT/.test(String(value))) return new Date(value).toLocaleString()
  return String(value)
}
function order(col) { const key = col.field || col.name; descending.value = sort.value === key ? !descending.value : false; sort.value = key }
</script>
<template>
  <div class="grid">
    <div class="grid-tools">
      <a-input v-model:value="search" :placeholder="t('过滤')" aria-label="过滤列表"/>
      <a-button @click="showFilters=!showFilters">列过滤</a-button>
      <span>{{ filtered.length }} {{ t('笔资料') }}</span><slot name="tools"/>
    </div>
    <div v-if="showFilters" class="column-filters">
      <div v-for="col in columns" :key="col.field || col.name" class="column-filter">
        <template v-if="columnFilters[col.field || col.name]">
          <span>{{ t(col.label || col.field || col.name) }}</span>
          <a-select v-model:value="columnFilters[col.field || col.name].operator" :aria-label="`${col.label}运算`"
            :options="(isDate(col) ? dateOps : textOps).map(([value,label]) => ({value,label}))"/>
          <template v-if="isDate(col) && columnFilters[col.field || col.name].operator === 'between'">
            <a-input v-for="bound in ['from','to']" :key="bound" type="datetime-local" step="1"
              v-model:value="columnFilters[col.field || col.name][bound]" @input="columnFilters[col.field || col.name].enabled=true"
              :aria-label="`${col.label}${bound==='from'?'起始':'结束'}`"/>
          </template>
          <a-input v-else :type="isDate(col) ? 'datetime-local' : 'text'" step="1"
            v-model:value="columnFilters[col.field || col.name].value" @input="columnFilters[col.field || col.name].enabled=true" :aria-label="`过滤${col.label}`"/>
          <a-button @click="columnFilters[col.field || col.name]=emptyFilter(col)">重置本列</a-button>
        </template>
      </div>
      <a-button @click="columnFilters=Object.fromEntries(columns.map(c=>[c.field||c.name,emptyFilter(c)]))">全部重置</a-button>
    </div>
    <a-table :columns="tableColumns" :data-source="filtered" :row-key="recordKey" :row-selection="rowSelection"
      :pagination="pagination" :scroll="{ x: 'max-content' }" size="middle" :locale="{ emptyText: t('查无资料') }"
      :row-class-name="row => [selected.some(item => recordKey(item) === recordKey(row)) ? 'selected' : '', row.ACTIVE==='N' ? 'hidden' : ''].join(' ')">
      <template #headerCell="{ column }">
        {{ column.title }}<small v-if="sort === column.dataIndex"> {{ descending ? '↓' : '↑' }}</small>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === '__actions'">
          <a-button type="link" class="link" @click="emit('open', record)">{{ t('查看') }}</a-button><slot name="actions" :row="record"/>
        </template>
        <a-tag v-else-if="['STATUS','ACTIVE','DEVICE_STATUS','AGENT_STATUS','RESULT'].includes(column.dataIndex)" class="tag" :color="tagColor(String(record[column.dataIndex]))">{{ label(record,column) }}</a-tag>
        <a-button v-else-if="column.link" type="link" class="link" @click="emit('open',record)">{{ label(record,column) }}</a-button>
        <span v-else :title="label(record,column)">{{ label(record,column) }}</span>
      </template>
    </a-table>
  </div>
</template>
<style scoped>
.column-filters {display:flex;flex-wrap:wrap;gap:16px;padding:16px;border-bottom:1px solid var(--border);align-items:end}
.column-filter {display:grid;gap:6px;width:190px}
</style>
