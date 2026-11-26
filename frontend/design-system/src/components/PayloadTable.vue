<script setup>
/** Structural payload table for metadata (below the Ant Design basics, above business patterns). */
defineProps({ rows: { type: Array, default: () => [] }, columns: { type: Array, default: () => [] } })
</script>
<template>
  <div class="grid">
    <div class="grid-tools"><span>{{ rows.length }} 笔结构定义</span><span class="muted">字段来源：backend metadata / seed</span></div>
    <a-table size="middle" :pagination="false" :data-source="rows" :columns="columns.map(c => ({ ...c, dataIndex: c.key, title: c.title }))" :scroll="{ x: 'max-content' }" row-key="name">
      <template #bodyCell="{ column, record }"><code v-if="column.key === 'name'" style="font-size:11px">{{ record.name }}</code><span v-else>{{ record[column.key] ?? '—' }}</span></template>
    </a-table>
  </div>
</template>
