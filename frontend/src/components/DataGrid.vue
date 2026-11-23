<script setup>
import { computed, ref, watch } from 'vue'
import { t, state } from '../state'
const props = defineProps({ rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] }, selectable: Boolean, rowKey: { type: String, default: '' } })
const emit = defineEmits(['select', 'open'])
const search = ref(''), page = ref(1), size = ref(20), selected = ref([]), sort = ref(''), descending = ref(false)
const columns = computed(() => props.columns.length ? props.columns : Object.keys(props.rows[0] || {}).filter(k => k !== 'PASSWORD_HASH').slice(0, 10).map(field => ({ field, label: field })))
const filtered = computed(() => {
  let rows = props.rows.filter(row => columns.value.some(c => String(row[c.field || c.name] ?? '').toLowerCase().includes(search.value.toLowerCase())))
  if (sort.value) rows = [...rows].sort((a, b) => String(a[sort.value] ?? '').localeCompare(String(b[sort.value] ?? ''), undefined, { numeric: true }) * (descending.value ? -1 : 1))
  return rows
})
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / size.value)))
const visible = computed(() => filtered.value.slice((page.value - 1) * size.value, page.value * size.value))
watch([search, size, () => props.rows], () => { page.value = 1; selected.value = []; emit('select', []) })
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
    <div class="grid-tools"><input v-model="search" :placeholder="t('过滤')" aria-label="过滤列表"><span>{{ filtered.length }} {{ t('笔资料') }}</span><slot name="tools"/></div>
    <div class="table-scroll">
      <table><thead><tr>
        <th v-if="selectable"><input type="checkbox" :checked="visible.length > 0 && visible.every(r => selected.includes(r))" @change="selectPage($event.target.checked)" aria-label="选择本页"/></th>
        <th v-for="col in columns" :key="col.field || col.name" @click="order(col)">{{ t(col.label || col.field || col.name) }} <small v-if="sort === (col.field || col.name)">{{ descending ? '↓' : '↑' }}</small></th>
        <th>{{ t('操作') }}</th>
      </tr></thead><tbody>
        <tr v-for="(row, index) in visible" :key="rowKey ? row[rowKey] : index" :class="{ selected: selected.includes(row), hidden: row.ACTIVE === 'N' }">
          <td v-if="selectable"><input type="checkbox" :checked="selected.includes(row)" @change="choose(row, $event.target.checked)" aria-label="选择资料"/></td>
          <td v-for="col in columns" :key="col.field || col.name" :title="label(row,col)">
            <span v-if="['STATUS','ACTIVE','DEVICE_STATUS','AGENT_STATUS','RESULT'].includes(col.field || col.name)" class="tag" :class="String(row[col.field || col.name])">{{ label(row,col) }}</span>
            <template v-else>{{ label(row,col) }}</template>
          </td>
          <td><button class="link" @click="emit('open', row)">{{ t('查看') }}</button><slot name="actions" :row="row"/></td>
        </tr>
        <tr v-if="!visible.length"><td :colspan="columns.length + 2" class="empty">{{ t('查无资料') }}</td></tr>
      </tbody></table>
    </div>
    <div class="pagination"><span>{{ t('每页') }} <select v-model.number="size"><option v-for="n in [20,25,50,100,200,500]" :key="n">{{ n }}</option></select></span>
      <button :disabled="page <= 1" @click="page--">‹</button><span>{{ page }} / {{ pages }}</span><button :disabled="page >= pages" @click="page++">›</button></div>
  </div>
</template>
