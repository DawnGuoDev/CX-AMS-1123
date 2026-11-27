<script setup>
const routes = [
  ['/foundation/tokens', 'Foundation · Design tokens', '项目实际主题、色彩、间距、圆角与密度。'],
  ['/components/catalog', 'Components · 目录', 'Ant Design Vue 4.2.6 基础组件与 AMS 五件套的清单、使用位置和 Props/Events。'],
  ['/components/table', 'Components · Table', 'Ant Design Vue Table：尺寸、分页、状态标签。'],
  ['/components/form', 'Components · Form', 'Ant Design Vue 输入、选择、校验与字段排列。'],
  ['/components/feedback', 'Components · Feedback', 'Button、Tag、Alert、Modal、Empty、Tooltip 等。'],
  ['/components/ams', 'Components · AMS', 'DataGrid、FieldForm、UiCheckbox、RecordDialog、AppSidebar。'],
  ['/business/master', 'Patterns · 主档编辑', '筛选、工具栏、主表格、宽弹窗、字段表单。'],
  ['/business/query', 'Patterns · 条件查询与结果表格', '条件弹窗 + 列过滤 + 状态标签 + 结果表格。'],
  ['/business/alarm', 'Patterns · 告警详情', '详情弹窗、基本资讯、发送/交易/层级/回应记录。'],
]
</script>
<template>
  <div class="gallery-head"><h1>路由索引</h1><p>每条路由都能在构建产物中直接打开；地址采用 hash 以支持静态托管。</p></div>
  <div style="margin-top:18px">
    <div v-for="[path, title, desc] in routes" :key="path" class="route-card">
      <div><h3>{{ title }}</h3><p>{{ desc }}</p></div><a :href="`#${path}`"><code>{{ path }}</code></a>
    </div>
  </div>
</template>
