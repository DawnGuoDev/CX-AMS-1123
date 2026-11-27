<script setup>
const baseColors = [
  ['主色 Primary', '#167D92', '按钮、链接、选中态、进度条'],
  ['页面底色', '#F3F6FA', '内容区背景'],
  ['卡片 / 内容面', '#FFFFFF', '面板、表格、顶栏'],
  ['边框', '#DDE5ED', '面板块、表格、工具栏分隔'],
  ['正文', '#23364A', '主文本'],
  ['次要文本', '#7A8998', '说明、辅助信息'],
  ['深色导航', '#122337', '侧栏背景'],
  ['导航选中', '#1C5063', '选中菜单底色（左侧 3px #52B9C6）'],
]
const statusColors = [
  ['Process / Unknown', '#A0710B', '#FFF5DC', 'warning'],
  ['Completed / Success / OK / Y', '#178779', '#E4F5EF', 'success'],
  ['NoNextLevel / Fail / Error / NG', '#C14848', '#FCECEC', 'error'],
  ['Terminated / N / default', '#788491', '#ECEFF3', 'default'],
]
const spacing = [['内容区 padding', '26px 28px 40px'], ['面板 padding', '22px'], ['面板圆角', '8px'], ['控件圆角', '6px'], ['网格间距', '18px'], ['表单项间距', '18px'], ['顶栏高度', '68px'], ['侧栏宽度', '248px / 72px'], ['页面标题', '24px / 650'], ['区块标题', '15px / 600']]
const typography = [['基准字号', '13px', 'Inter, -apple-system, "PingFang SC", "Microsoft YaHei"'], ['辅助字号', '11–12px', '说明、表格工具条、元数据'], ['微标签', '10px', '状态标签、eyebrow、顶栏品牌行'], ['行高（正文）', '1.8–1.9', '说明与告警内容']]
</script>
<template>
  <div class="gallery-head"><h1>Design tokens</h1><p>取自 <code>frontend/src/App.vue</code> 的 ConfigProvider 与 <code>frontend/src/style.css</code>。基础控件颜色仍由 Ant Design Vue 4.2.6 生成，这里只记录产品层实际使用的令牌。</p></div>
  <section class="example"><div class="example-head"><div><h3>Product colors</h3><p>主色与中性色来自项目真实样式，不是 Ant 默认蓝。</p></div></div>
    <div class="example-body"><div class="swatch-grid">
      <div v-for="[name, hex, use] in baseColors" :key="name" class="swatch"><div class="swatch-color" :style="{ background: hex, borderBottom: '1px solid #dde5ed' }"/><div class="swatch-meta"><span><b>{{ name }}</b><br>{{ use }}</span><code>{{ hex }}</code></div></div>
    </div></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Status colors</h3><p>与 <code>DataGrid.tagColor</code> / <code>.tag.*</code> 完全一致；状态文字使用深色前景、浅色背景，而不是整块高饱和色。</p></div></div>
    <div class="example-body"><div class="status-grid">
      <div v-for="[status, fg, bg] in statusColors" :key="status" class="status-sample">
        <span class="tag" :class="status.split(' / ')[0]" :style="{ color: fg, background: bg }">{{ status.split(' / ')[0] }}</span>
        <div><code>{{ fg }}</code> on <code>{{ bg }}</code></div><div style="margin-top:4px">业务状态：{{ status }}</div>
      </div>
    </div></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Table density</h3><p>生产 DataGrid 使用 Ant Design Vue <code>size="middle"</code>，默认 20 笔/页；下表是同一份数据在 middle 与 small 下的对比，避免误用 compact。</p></div></div>
    <div class="example-body"><div class="density-compare">
      <div><h4>AMS: size="middle" + 20 rows</h4><a-table size="middle" :pagination="{ pageSize: 20, showSizeChanger: false }" :data-source="[
        { code: 'ALM-20261126-1024', title: '印刷机缺染料', status: 'Process' },
        { code: 'ALM-20261126-1023', title: '机台腔体过热', status: 'Completed' },
        { code: 'ALM-20261126-1022', title: 'MES 通讯中断', status: 'NoNextLevel' },
      ]" :columns="[{ title: '警报识别码', dataIndex: 'code' }, { title: '警报标题', dataIndex: 'title' }, { title: '状态', dataIndex: 'status' }]"><template #bodyCell="{ column, record }"><span v-if="column.dataIndex === 'status'" class="tag" :class="record.status">{{ record.status }}</span><span v-else>{{ record[column.dataIndex] }}</span></template></a-table></div>
      <div><h4>对照：size="small"（不采用）</h4><a-table size="small" :pagination="false" :data-source="[
        { code: 'ALM-20261126-1024', title: '印刷机缺染料', status: 'Process' },
        { code: 'ALM-20261126-1023', title: '机台腔体过热', status: 'Completed' },
        { code: 'ALM-20261126-1022', title: 'MES 通讯中断', status: 'NoNextLevel' },
      ]" :columns="[{ title: '警报识别码', dataIndex: 'code' }, { title: '警报标题', dataIndex: 'title' }, { title: '状态', dataIndex: 'status' }]"><template #bodyCell="{ column, record }"><span v-if="column.dataIndex === 'status'" class="tag" :class="record.status">{{ record.status }}</span><span v-else>{{ record[column.dataIndex] }}</span></template></a-table></div>
    </div></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Spacing & typography</h3><p>从真实 CSS 提取，不引入额外设计语言。</p></div></div>
    <div class="example-body" style="display:grid;grid-template-columns:1fr 1fr;gap:24px">
      <table class="ant-table token-table"><tbody><tr v-for="[k, v] in spacing" :key="k"><td>{{ k }}</td><td class="mono">{{ v }}</td></tr></tbody></table>
      <table class="ant-table token-table"><tbody><tr v-for="[k, v, note] in typography" :key="k"><td>{{ k }}</td><td class="mono">{{ v }}<div style="color:#7a8998;font-family:inherit;margin-top:3px">{{ note }}</div></td></tr></tbody></table>
    </div>
  </section>
</template>
