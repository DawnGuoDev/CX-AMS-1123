<script setup>
import { ref } from 'vue'
import { Empty } from 'ant-design-vue'
const open = ref(false)
const buttonLoading = ref(false)
function fakeLoading() { buttonLoading.value = true; setTimeout(() => { buttonLoading.value = false }, 1000) }
</script>
<template>
  <div class="gallery-head"><h1>Feedback · 操作与反馈</h1><p>项目中的主按钮、次按钮、纯文字按钮、状态标签、提示与弹窗；交互只影响本地演示状态。</p></div>
  <section class="example"><div class="example-head"><div><h3>Buttons</h3><p>主按钮用于唯一主动作（新增、查询、储存）；次按钮用于并列动作；链接按钮放在表格操作列。</p></div></div>
    <div class="example-body demo-stack"><div class="demo-row"><a-button type="primary">主要操作</a-button><a-button>次要操作</a-button><a-button danger>危险操作</a-button><a-button type="link">查看</a-button><a-button type="primary" :loading="buttonLoading" @click="fakeLoading">载入中</a-button></div><div class="demo-row"><a-button size="small">small（工具栏）</a-button><a-button size="middle">middle（默认）</a-button><a-button size="large">large（不建议）</a-button></div></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Tags / status</h3><p>状态标签语义与 DataGrid 一致，不新增其他业务状态色。</p></div></div>
    <div class="example-body demo-row"><span v-for="s in ['Process', 'Completed', 'NoNextLevel', 'Fail', 'Success', 'Unknown', 'N']" :key="s" class="tag" :class="s" style="padding:6px 10px;font-size:11px">{{ s }}</span></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Alerts & empty</h3><p>全局错误固定在顶栏下方右侧；行内提示使用浅色背景；空状态使用 Ant Design 的简单空图。</p></div></div>
    <div class="example-body demo-stack"><a-alert type="error" show-icon message="无法载入资料，请稍后重试"/><a-alert type="warning" show-icon message="SMTP 尚未配置，触发后邮件会记录为失败"/><a-alert type="success" show-icon message="储存成功"/><a-empty description="查无资料" :image="Empty.PRESENTED_IMAGE_SIMPLE"/></div>
  </section>
  <section class="example"><div class="example-head"><div><h3>Modal</h3><p>单笔记录 640px；含表格或双列表的编辑采用 1120px。footer 可由内容自定义。</p></div></div>
    <div class="example-body"><a-button type="primary" @click="open = true">打开弹窗</a-button><a-modal v-model:open="open" title="确认储存？" centered :width="640"><p>此操作仅演示本地弹窗，不会调用后端。</p><template #footer><a-button @click="open = false">取消</a-button><a-button type="primary" @click="open = false">确定</a-button></template></a-modal></div>
  </section>
</template>
