<script setup>
import { computed, ref, watch } from 'vue'
import { t, state } from '../state'
import { textOps,dateOps,emptyFilter,matches,isDate } from '../filters'
const props = defineProps({ rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] }, selectable: Boolean, rowKey: { type: String, default: '' } })
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
const visible = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value))
watch(filtered,rows=>{emit('filtered',rows);page.value=Math.min(page.value,pages.value)},{immediate:true})
watch(()=>columns.value.map(c=>`${c.field||c.name}:${c.type}`).join('|'),()=>{
  columnFilters.value=Object.fromEntries(columns.value.map(c=>[c.field||c.name,emptyFilter(c)]))
},{immediate:true})
defineExpose({filtered})
watch([search, size, () => props.rows], () => { page.value = 1; selected.value = []; emit('select', []) })
watch(columnFilters,()=>{page.value=1;selected.value=[];emit('select',[])},{deep:true})
function choose(row, checked) {
  selected.value = checked ? [...selected.value, row] : selected.value.filter(x => x !== row)
  emit('select', selected.value)
}
function selectPage(checked) { selected.value = checked ? [...visible.value] : []; emit('select', selected.value) }
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
    <div class="grid-tools"><input v-model="search" :placeholder="t('过滤')" aria-label="过滤列表"><button type="button" @click="showFilters=!showFilters">列过滤</button><span>{{ filtered.length }} {{ t('笔资料') }}</span><slot name="tools"/></div>
    <div class="table-scroll">
      <table><thead><tr>
        <th v-if="selectable"><input type="checkbox" :checked="visible.length > 0 && visible.every(r => selected.includes(r))" @change="selectPage($event.target.checked)" aria-label="选择本页"/></th>
        <th v-for="col in columns" :key="col.field || col.name" @click="order(col)">{{ t(col.label || col.field || col.name) }} <small v-if="sort === (col.field || col.name)">{{ descending ? '↓' : '↑' }}</small></th>
        <th>{{ t('操作') }}</th>
      </tr><tr v-if="showFilters"><th v-if="selectable"/><th v-for="col in columns" :key="col.field||col.name">
        <div v-if="columnFilters[col.field||col.name]" class="column-filter">
          <select v-model="columnFilters[col.field||col.name].operator" :aria-label="`${col.label}运算`">
            <option v-for="[value,label] in isDate(col)?dateOps:textOps" :key="value" :value="value">{{label}}</option>
          </select>
          <template v-if="isDate(col)&&columnFilters[col.field||col.name].operator==='between'">
            <input v-for="bound in ['from','to']" :key="bound" type="datetime-local" step="1" v-model="columnFilters[col.field||col.name][bound]" @input="columnFilters[col.field||col.name].enabled=true" :aria-label="`${col.label}${bound==='from'?'起始':'结束'}`">
          </template>
          <input v-else :type="isDate(col)?'datetime-local':'text'" step="1" v-model="columnFilters[col.field||col.name].value" @input="columnFilters[col.field||col.name].enabled=true" :aria-label="`过滤${col.label}`">
          <button type="button" @click="columnFilters[col.field||col.name]=emptyFilter(col)">重置本列</button>
        </div>
      </th><th><button type="button" @click="columnFilters=Object.fromEntries(columns.map(c=>[c.field||c.name,emptyFilter(c)]))">全部重置</button></th></tr></thead><tbody>
        <tr v-for="(row, index) in visible" :key="rowKey ? row[rowKey] : index" :class="{ selected: selected.includes(row), hidden: row.ACTIVE === 'N' }">
          <td v-if="selectable"><input type="checkbox" :checked="selected.includes(row)" @change="choose(row, $event.target.checked)" aria-label="选择资料"/></td>
          <td v-for="col in columns" :key="col.field || col.name" :title="label(row,col)">
            <span v-if="['STATUS','ACTIVE','DEVICE_STATUS','AGENT_STATUS','RESULT'].includes(col.field || col.name)" class="tag" :class="String(row[col.field || col.name])">{{ label(row,col) }}</span>
            <button type="button" v-else-if="col.link" class="link" @click="emit('open',row)">{{label(row,col)}}</button>
            <template v-else>{{ label(row,col) }}</template>
          </td>
          <td><button type="button" class="link" @click="emit('open', row)">{{ t('查看') }}</button><slot name="actions" :row="row"/></td>
        </tr>
        <tr v-if="!visible.length"><td :colspan="columns.length + 2" class="empty">{{ t('查无资料') }}</td></tr>
      </tbody></table>
    </div>
    <div class="pagination"><span>{{ t('每页') }} <select v-model.number="size"><option v-for="n in [20,25,50,100,200,500]" :key="n">{{ n }}</option></select></span>
      <button type="button" :disabled="page <= 1" @click="page--">‹</button><span>{{ page }} / {{ pages }}</span><button type="button" :disabled="page >= pages" @click="page++">›</button></div>
  </div>
</template>
<style scoped>
.column-filter {display:grid;gap:5px;min-width:165px}
.column-filter input,.column-filter select {width:100%;min-width:0}
</style>
