<script setup>
import { Modal as AModal } from 'ant-design-vue'
import { t } from '../state'
defineProps({ title: String, wide: Boolean })
defineEmits(['close'])
</script>
<template>
  <a-modal :open="true" :title="t(title)" :width="wide ? 1120 : 640" :footer="null" :mask-closable="false" centered destroy-on-close
    :wrap-class-name="wide ? 'record-modal large' : 'record-modal'" @cancel="$emit('close')">
    <div class="dialog-body"><slot/></div>
  </a-modal>
</template>
