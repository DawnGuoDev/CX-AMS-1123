<script setup>
import { computed } from 'vue'
import { runtime } from '../composables/useMockData.js'

const totals = computed(() => {
  const counts = runtime.alarms.reduce((map, alarm) => ({ ...map, [alarm.STATUS]: (map[alarm.STATUS] || 0) + 1 }), {})
  return [
    { label: '处理中', value: counts.Process || 0, note: '需要人员确认' },
    { label: '已完成', value: counts.Completed || 0, note: '已达成 ACK 人数' },
    { label: '无下一层级', value: counts.NoNextLevel || 0, note: '升级到最后一层' },
    { label: '本日警报', value: runtime.alarms.length, note: '本地演示资料' },
  ]
})
</script>
<template>
  <div class="home-intro">
    <h1>AMS 设计系统</h1>
    <p>Ant Design Vue 4.2.6 基础组件 + AMS 产品规范 + 可验收的业务组合。所有预览使用本地固定数据，不连接 Java 服务，也不需要登录。</p>
    <ul>
      <li>主题与布局：主色 #167d92，13px 基准字号，6px 圆角，68px 顶栏，248/72px 侧栏。</li>
      <li>表格密度：Ant Design Vue <b>middle</b> 行高，默认 20 笔/页，可切换 25/50/100/200/500。</li>
      <li>业务组合：主档编辑、条件查询与结果表格、告警详情。</li>
    </ul>
  </div>
  <div class="kpis">
    <div v-for="item in totals" :key="item.label" class="kpi"><span>{{ item.label }}</span><strong>{{ item.value }}</strong><small>{{ item.note }}</small></div>
  </div>
</template>
<style scoped>
.home-intro{background:#fff;border:1px solid var(--border);border-radius:8px;padding:24px;margin-bottom:20px}.home-intro h1{margin-bottom:10px}.home-intro p{color:#708396;max-width:880px;line-height:1.9}.home-intro ul{margin:12px 0 0;padding-left:20px;color:#415e73;line-height:2;font-size:12px}
</style>
