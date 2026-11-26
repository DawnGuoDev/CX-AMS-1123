<script setup>
import { reactive, ref } from 'vue'
const model = reactive({ userId: '', userName: '', dept: '设备工程部', active: 'Y', date: '2026-11-26', note: '' })
const rules = { userId: [{ required: true, message: '请输入使用者代码' }], userName: [{ required: true, message: '请输入使用者名称' }] }
const formRef = ref()
async function validate() { try { await formRef.value.validate(); window.alert('校验通过（本地演示）') } catch { /* AntD displays field errors */ } }
</script>
<template>
  <div class="gallery-head"><h1>Form · 表单</h1><p>Ant Design Vue 4.2.6 的 Input、Select、Checkbox、Button 与校验；尺寸遵循 AMS 13px 基准字号与 2 列表单节奏。</p></div>
  <section class="example"><div class="example-head"><div><h3>Basic form</h3><p>必填项用红色星号；提交前由 <code>Form</code> 统一校验。这里不发送请求。</p></div></div>
    <div class="example-body">
      <a-form ref="formRef" :model="model" :rules="rules" layout="vertical" style="max-width:720px">
        <div class="fields">
          <label><span>使用者代码 <b style="color:#c4713b">*</b></span><a-form-item name="userId" style="margin:0"><a-input v-model:value="model.userId" placeholder="例如 E0043258"/></a-form-item></label>
          <label><span>使用者名称 <b style="color:#c4713b">*</b></span><a-form-item name="userName" style="margin:0"><a-input v-model:value="model.userName" placeholder="例如 陈柏睿"/></a-form-item></label>
          <label><span>部门</span><a-form-item style="margin:0"><a-select v-model:value="model.dept" :options="[{ value: '设备工程部', label: '设备工程部' }, { value: '制程工程部', label: '制程工程部' }, { value: '资讯部', label: '资讯部' }]"/></a-form-item></label>
          <label><span>到职日</span><a-form-item style="margin:0"><a-input v-model:value="model.date" type="date"/></a-form-item></label>
          <label class="wide"><span>是否公司员工</span><a-checkbox v-model:checked="model.active" true-value="Y" false-value="N">是（API 以 Y/N 保存）</a-checkbox></label>
          <label class="wide"><span>备注</span><a-textarea v-model:value="model.note" :rows="3" placeholder="本地演示，不写入后端"/></label>
        </div>
        <div class="form-actions"><a-button @click="() => { model.userId = ''; model.userName = '' }">重设</a-button><a-button type="primary" @click="validate">储存</a-button></div>
      </a-form>
      <p class="note" style="margin-top:18px">表单值：<code>{{ JSON.stringify(model) }}</code></p>
    </div>
  </section>
</template>
