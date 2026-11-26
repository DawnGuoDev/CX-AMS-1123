<script setup>
/**
 * AMS record dialog: 640px for single records, 1120px for metadata editors.
 * Always controlled by the parent via v-model:open; no global state.
 */
import { computed } from 'vue'

const props = defineProps({
  open: { type: Boolean, default: true },
  title: { type: String, default: '' },
  wide: Boolean,
  confirmLoading: Boolean,
  okText: { type: String, default: '储存' },
  cancelText: { type: String, default: '取消' },
  footer: { type: [Boolean, Object, Function], default: undefined },
})
const emit = defineEmits(['update:open', 'close', 'ok'])
const visible = computed({ get: () => props.open, set: value => emit('update:open', value) })
function close() { emit('update:open', false); emit('close') }
</script>
<template>
  <a-modal v-model:open="visible" :title="title" :width="wide ? 1120 : 640" centered destroy-on-close
    :confirm-loading="confirmLoading" :ok-text="okText" :cancel-text="cancelText" :footer="footer"
    :wrap-class-name="wide ? 'record-modal large' : 'record-modal'" @cancel="close" @ok="$emit('ok')">
    <div class="dialog-body"><slot/></div>
  </a-modal>
</template>
