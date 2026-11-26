<script setup>
import { computed, ref } from 'vue'
import DataGrid from '../components/DataGrid.vue'
import { runtime, notify } from '../composables/useMockData.js'

const rows = computed(() => runtime.alarms)
const selected = ref([])
const columns = [
  { field: 'ALARM_ID', label: '警报识别码' }, { field: 'TITLE', label: '警报标题' }, { field: 'STATUS', label: '状态' },
  { field: 'FACTORY_ID', label: '厂别' }, { field: 'SUB_SYS_ID', label: '子系统' }, { field: 'EQP_ID', label: '机台' },
  { field: 'LEVEL_ACK_COUNT', label: '已回应人数' }, { field: 'LEVEL_REQUIRED', label: '需要回应的人数' }, { field: 'CREATE_DT', label: '资料新增时间' },
]
function open(row) { notify(`已选择 ${row.ALARM_ID}（本地数据，不打开后端详情）`) }
</script>
<template>
  <div class="gallery-head"><h1>Table · 结果表格</h1><p>基础组件以 Ant Design Vue 4.2.6 为准；下方表格的组合来自 AMS <code>DataGrid</code>：middle 密度、状态标签、排序、列过滤和 20 笔分页。</p></div>
  <section class="example"><div class="example-head"><div><h3>DataGrid / 结果网格</h3><p>点列头排序；「列过滤」可叠加按列条件；选择后触发 <code>select</code> 事件；查看动作由父层处理。</p></div><span class="badge-local"><i/>LOCAL MOCK</span></div>
    <div class="example-body">
      <DataGrid :rows="rows" :columns="columns" row-key="ALARM_KEY" selectable @select="selected = $event" @open="open">
        <template #tools><span class="muted">已选 {{ selected.length }} 笔</span><a-button size="small" @click="selected = []">清除选择</a-button></template>
      </DataGrid>
    </div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Ant Design Vue Table</h3><p>原生 API 与参数可直接对照官方 4.2.6 文档；AMS 只在外层包裹工具条、密度和状态渲染。</p></div></div>
    <div class="example-body"><a-table :data-source="rows" :columns="columns.slice(0, 5).map(c => ({ ...c, dataIndex: c.field, title: c.label }))" :pagination="{ pageSize: 5, size: 'middle' }" size="middle" row-key="ALARM_KEY"><template #bodyCell="{ column, record }"><span v-if="column.dataIndex === 'STATUS'" class="tag" :class="record.STATUS">{{ record.STATUS }}</span><span v-else>{{ record[column.dataIndex] }}</span></template></a-table></div>
  </section>
</template>
