<script setup>
// Adapted from release pages/MasterPage.vue: real toolbar + DataGrid + RecordDialog + FieldForm
// composition; persistence is the preview mock master store.
import { ref, computed, onMounted } from 'vue'
import { Button as AButton, Input as AInput, Select as ASelect } from 'ant-design-vue'
import { state, clone, notify, t } from '../state'
import DataGrid from '../components/DataGrid.vue'
import RecordDialog from '../components/RecordDialog.vue'
import FieldForm from '../components/FieldForm.vue'
import { previewMasterStore } from '../mock/api.js'
const props = defineProps({ code: String })
const store = previewMasterStore()
const master = computed(() => state.meta.masters[props.code] || {})
const rows = ref([]), search = ref(''), draft = ref(null), editing = ref(false), selected = ref([])
function load() { rows.value = store.rows(props.code).filter(r => !search.value || Object.values(r).some(v => String(v).toLowerCase().includes(search.value.toLowerCase()))) }
onMounted(load)
const keyField = computed(() => master.value.columns?.[0]?.field || 'USER_ID')
function create() { editing.value = false; draft.value = Object.fromEntries((master.value.fields || []).map(f => [f.name, f.type === 'checkbox' ? 'Y' : ''])) }
function edit(row) { editing.value = true; draft.value = clone(row) }
function save() {
  store.save(props.code, draft.value, editing.value)
  draft.value = null; load(); notify(editing.value ? '已更新（预览仅保存在本页内存）' : '已新增（预览仅保存在本页内存）')
}
</script>
<template>
  <div class="toolbar">
    <a-input v-model:value="search" placeholder="快速过滤" aria-label="快速过滤" @input="load" style="width:220px"/>
    <a-button type="primary" @click="create">新增</a-button>
    <a-button :disabled="selected.length !== 1" @click="edit(selected[0])">编辑</a-button>
    <span class="spacer"/>
    <span class="muted">预览 Mock · {{ rows.length }} 笔资料</span>
  </div>
  <DataGrid :rows="rows" :columns="master.columns || []" row-key="__idx" selectable @select="selected = $event" @open="edit">
    <template #actions="{ row }"><a-button type="link" class="link" @click="edit(row)">编辑</a-button></template>
  </DataGrid>
  <RecordDialog v-if="draft" :title="editing ? '编辑资料' : '新增资料'" @close="draft = null">
    <FieldForm :fields="master.fields || []" :model="draft" :editing="editing"/>
    <div class="form-actions"><a-button @click="draft = null">取消</a-button><a-button type="primary" @click="save">保存</a-button></div>
  </RecordDialog>
</template>
