<script setup>
import { onMounted, ref, watch } from 'vue'
import { state, api, act, t, notify, downloadJson } from '../state'
const factory=ref(''),subsys=ref(''),data=ref({tree:[],groups:[]}),file=ref(null)
watch(factory,()=>{subsys.value='';data.value={tree:[],groups:[]}})
watch(subsys,()=>{data.value={tree:[],groups:[]}})
async function load() {
  data.value=await api(`/event-tree?factory=${factory.value}&subsys=${subsys.value}`)
  for(const e of data.value.tree) for(const l of e.LEVELS) for(const g of l.GROUPS) g.devices=(g.ENABLE_SEND_DEVICES||'').split(';').filter(Boolean)
}
function payload() {
  return {factoryKey:factory.value,subsysKey:subsys.value,levels:data.value.tree.flatMap(e=>e.LEVELS.map(l=>({levelKey:l.EVENT_LEVEL_KEY,groups:l.GROUPS.map(g=>({groupKey:g.EVENT_GROUP_KEY,devices:g.devices,imType:g.E_IM_GROUP_TYPE}))})))}
}
async function save() {await api('/event-tree/save',payload());notify('储存成功');await load()}
async function importFile(event) {
  const source=event.target.files[0];event.target.value='';if(!source)return
  await act(async()=>{
    const imported=JSON.parse(await source.text())
    if(imported.factoryKey!==factory.value || imported.subsysKey!==subsys.value) throw new Error('导入文件的厂别／子系统与当前选择不同')
    for(const e of data.value.tree) for(const l of e.LEVELS) {
      const found=imported.levels?.find(x=>x.levelKey===l.EVENT_LEVEL_KEY)
      if(!found)throw new Error('导入文件缺少层级')
      l.GROUPS=found.groups.map(g=>({EVENT_GROUP_KEY:g.groupKey,devices:g.devices,E_IM_GROUP_TYPE:g.imType}))
    }
    notify('已载入，请检查并储存')
  })
}
onMounted(()=>{factory.value=state.options.factory?.[0]?.value||''})
</script>
<template>
  <div class="toolbar"><label>{{ t('厂别') }} <select v-model="factory"><option value="">{{ t('请选择') }}</option><option v-for="o in state.options.factory" :key="o.value" :value="o.value">{{ o.label }}</option></select></label><label>{{ t('子系统') }} <select v-model="subsys"><option value="">{{ t('请选择') }}</option><option v-for="o in state.options.subsystemByFactory?.[factory]||[]" :key="o.value" :value="o.value">{{ o.label }}</option></select></label><button class="primary" :disabled="!factory||!subsys" @click="act(load)">{{ t('查询') }}</button></div>
  <div v-if="data.tree.length" class="toolbar"><button class="primary" @click="act(save)">{{ t('储存') }}</button><button @click="downloadJson(payload(),'event-tree.json')">{{ t('汇出') }}</button><button @click="file.click()">{{ t('汇入') }}</button><input type="file" ref="file" accept=".json" hidden @change="importFile"></div>
  <div v-for="event in data.tree" :key="event.EVENT_KEY" class="panel event-tree"><h3>{{ event.EVENT_ID }} · {{ event.EVENT_NAME }}</h3>
    <details v-for="level in event.LEVELS" :key="level.EVENT_LEVEL_KEY" open><summary>LEVEL-{{ level.EVENT_LEVEL_ID }} · {{ level.EVENT_LEVEL_DESC }} <span class="muted">{{ t('需要回应的人数') }} {{ level.NUMBER_OF_ACK_USERS }}</span></summary>
      <div v-for="(group,i) in level.GROUPS" :key="i" class="group-row"><select v-model="group.EVENT_GROUP_KEY"><option value="">{{ t('请选择') }}</option><option v-for="g in data.groups" :key="g.value" :value="g.value">{{ g.label }}</option></select><label v-for="ch in data.channels" :key="ch.value" class="check"><input type="checkbox" :value="ch.value" v-model="group.devices">{{ ch.label }}</label><select v-model="group.E_IM_GROUP_TYPE"><option v-for="o in data.imGroupTypes" :key="o.value" :value="o.value">{{ o.label }}</option></select><button @click="level.GROUPS.splice(i,1)">{{ t('移除') }}</button></div>
      <button @click="level.GROUPS.push({EVENT_GROUP_KEY:'',devices:['Email'],E_IM_GROUP_TYPE:'ByEventGroup'})">{{ t('新增群组') }}</button>
    </details>
  </div><div v-if="!data.tree.length" class="panel empty">{{ t('请选择厂别与子系统后查询') }}</div>
</template>
