<script setup>
import { Button as AButton } from 'ant-design-vue'
import { computed,onMounted } from 'vue'
import { state,t,openAlarm } from '../state'
import MasterPage from './MasterPage.vue'
import OperationsPage from './OperationsPage.vue'
import ReportPage from './ReportPage.vue'
import { pageTitle } from '../page-title'
const props=defineProps({code:String,alarmKey:String})
const master=computed(()=>state.meta.masters?.[props.code]||state.meta.mappings?.[props.code]||state.meta.masterDetails?.[props.code])
const title=computed(()=>pageTitle(props.code,master.value,state.meta.pageTitles))
onMounted(()=>{if(props.code==='ACK')openAlarm(props.alarmKey)})
</script>
<template>
  <div class="page-heading"><h1>{{ t(title) }}</h1></div>
  <MasterPage v-if="master" :code="code"/>
  <OperationsPage v-else-if="['TEST','ACK_LIST'].includes(code)" :code="code"/>
  <ReportPage v-else-if="['HOME','AVPA013','AVPA004','AVPA007','AVPA008'].includes(code)" :code="code==='HOME'?'AVPA013':code"/>
  <template v-else-if="code==='ACK'"><p>请查看告警详情，以本层级通知人员账号确认。打开邮件链接不会自动 ACK。</p><a-button class="primary" @click="openAlarm(alarmKey)" type="primary" html-type="button">打开确认页</a-button></template>
</template>
