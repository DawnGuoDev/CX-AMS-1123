const f=(name,label,type='text',extra={})=>({name,label,type,...extra})
const select=(name,label,optionSet)=>f(name,label,'select',{optionSet})
export const configurations={
  CVMA015:{endpoint:'auto-status',key:'AUTO_KEY',id:'AUTO_ID',fields:[
    f('AUTO_ID','规则代码','text',{required:true}),f('AUTO_NAME','规则名称','text',{required:true}),
    select('SUB_SYS_KEY','子系统','subsystem'),select('EQP_KEY','机台','eqpWithAny'),select('CHAMBER','Chamber','chamber'),
    select('ALARM_INFO_KEY','警报代码','alarmSetting'),select('INITIAL_STATUS','初始机况','eqpStatus'),
    select('TARGET_STATUS','目标机况','eqpStatus'),select('TARGET_STATUS2','目标机况2','eqpStatus'),f('RELATED_CHAMBER','Related Chamber','checkbox'),
  ],steps:['规则资讯'],description:'每 5 分钟扫描近 30 分钟警报，也可立即扫描。切机及 Chamber 联动为本地模拟。'},
  AVMA010:{endpoint:'alarm-conditions',key:'CONDITION_KEY',id:'CONDITION_ID',steps:['条件资讯','SQL 与时间','标题模板','内容模板'],fields:[
    f('CONDITION_ID','条件代码','text',{required:true,step:0}),f('CONDITION_NAME','条件名称','text',{required:true,step:0}),
    select('ALARM_INFO_KEY','警报代码','alarmSetting'),f('DELAY_TIME','延迟时间','number'),
    f('ALARM_MSG_SQL','SQL','sql',{step:1}),f('DATE_CONDITION_FIELD','时间字段','text',{step:1}),f('DATE_TIME_TYPE','时间型态','text',{step:1}),
    f('ALARM_SUBJECT','标题模板','textarea',{step:2}),f('ALARM_CONTENT','内容模板','textarea',{step:3}),
  ],description:'保存触发条件定义；SQL 测试仅解析结构并返回模拟资料，不执行任意 SQL。'},
  MCMS051:{endpoint:'batch-defs',key:'BATCH_KEY',id:'BATCH_ID',steps:['批次资讯','显示资讯','条件设定','资料表关联'],fields:[
    f('BATCH_ID','批次代码','text',{required:true}),f('BATCH_NAME','批次名称','text',{required:true}),f('BATCH_DESC','说明'),
    f('MASTER_TABLE_NAME','主资料表'),f('MASTER_LOG_TABLE_NAME','履历表'),f('MASTER_PK','主键'),f('SERIAL_KEY_COLUMN_NAME','序号栏位'),f('ACTIVE_COLUMN_NAME','状态栏位'),
    f('DATA_SOURCE_SQL','资料来源 SQL','sql'),f('DISPLAY_COLUMNS_JSON','显示栏位','json',{step:1}),f('CONDITIONS_JSON','条件设定','json',{step:2}),f('RELATIONS_JSON','资料表关联','json',{step:3}),
  ],description:'维护批次状态定义，警报批次隐藏在 CVMA014 页面执行。'},
  RPTSET001:{endpoint:'report-defs',key:'REPORT_KEY',id:'REPORT_ID',steps:['报表资讯','资料来源','查询条件','条件语法','资料呈现','栏位资讯','DrillDown','图表','图例','Y 轴','数列','圆饼图','枢纽资讯','枢纽栏位','枢纽列','枢纽数值','汇出设定','其他设定'],fields:[
    f('REPORT_ID','报表代码','text',{required:true}),f('REPORT_NAME','报表名称','text',{required:true}),f('REPORT_DESC','说明'),
    f('CONNECTION_STRING_NAME','连接名称','text',{step:1}),select('DATASOURCE_TYPE','资料来源','reportDataSourceType'),
    f('QUERY_SQL','查询 SQL','sql',{step:1}),f('ATLEAST_ONE_CONDITION','至少一个查询条件','checkbox',{step:2}),
    f('CONDITIONS_JSON','查询条件','json',{step:2}),f('DISPLAY_JSON','资料呈现','json',{step:4}),f('COLUMNS_JSON','栏位资讯','json',{step:5}),
  ],description:'查询条件与栏位配置影响内建报表；SQL 与图表／枢纽高级配置保存为定义。'},
}
for(const [code,type] of Object.entries({MCMS040:'Normal',MCMS042:'Mapping',MCMS041:'MasterDetail'})) {
  configurations[code]={endpoint:'brm-defs',key:'BRM_KEY',id:'BRM_ID',type,steps:type==='MasterDetail'?['主资料','主履历','明细','明细履历']:type==='Mapping'?['主要资讯','Master 栏位','Item 栏位','Mapping 栏位']:['主要资讯','栏位资讯'],fields:[
    f('BRM_ID','主档代码','text',{required:true}),f('BRM_NAME','主档名称','text',{required:true}),f('BRM_DESC','说明'),
    f('MST_TABLE_NAME','主资料表'),f('MST_LOG_TABLE_NAME','履历表'),f('MST_PK','主键'),f('MST_UK','唯一键'),
    f('MST_DATA_QUERY_SQL','查询 SQL','sql'),f('MST_HIDE_DATA_QUERY_SQL','隐藏资料 SQL','sql'),f('MST_LOG_QUERY_SQL','履历 SQL','sql'),
    f('EDIT_FORM_COLUMN_COUNT','编辑栏数','number'),f('ENABLE_CUSTOM_VALIDATE','客制验证','checkbox'),f('VALIDATE_CLASS_NAME','验证类'),
    f('COLUMNS_JSON','主栏位','json',{step:1}),f('DETAIL_TABLE_NAME','明细资料表','text',{step:2}),f('DETAIL_LOG_TABLE_NAME','明细履历表','text',{step:2}),
    f('DETAIL_COLUMNS_JSON','明细栏位','json',{step:2}),
  ],description:'维护元数据定义，预置主档页由 Java 元数据驱动。SQL 与客制验证类仅保存配置。'}
  if(type==='Normal') configurations[code].fields=configurations[code].fields.filter(field=>!field.name.startsWith('DETAIL_'))
  if(type==='MasterDetail') {
    configurations[code].steps=['主资料与栏位','主履历','明细与栏位','明细履历']
    for(const field of configurations[code].fields) {
      if(field.name==='COLUMNS_JSON')field.step=0
      if(['MST_LOG_TABLE_NAME','MST_LOG_QUERY_SQL'].includes(field.name))field.step=1
      if(field.name==='DETAIL_LOG_TABLE_NAME')field.step=3
    }
    configurations[code].fields.push(f('DETAIL_PK','明细主键','text',{step:2}),f('DETAIL_UK','明细唯一键','text',{step:2}),f('DETAIL_DATA_QUERY_SQL','明细查询 SQL','sql',{step:2}),f('DETAIL_LOG_QUERY_SQL','明细履历 SQL','sql',{step:3}))
  }
  if(type==='Mapping') {
    configurations[code].steps=['主要资讯','Master 查询','Item 查询','Mapping 栏位']
    configurations[code].fields=[
      f('BRM_ID','主档代码','text',{required:true}),f('BRM_NAME','主档名称','text',{required:true}),f('BRM_DESC','说明'),
      f('MAP_TABLE_NAME','对应资料表'),f('MAP_LOG_TABLE_NAME','对应履历表'),f('MAP_PK','对应主键'),f('MAP_UK','对应唯一键'),
      f('MST_COLUMN_NAME','Master 栏位'),f('MST_COLUMN_CAPTION','Master 标题'),f('VALUE_MEMBER','值栏位'),f('DISPLAY_MEMBER','显示栏位'),
      f('IMPORT_CONDITION_COLUMN_NAME','汇入条件栏位'),f('IS_MULTI_SELECT','允许多选','checkbox'),
      f('ENABLE_CUSTOM_VALIDATE','客制验证','checkbox'),f('VALIDATE_CLASS_NAME','验证类'),
      f('MST_DATA_QUERY_SQL','Master 查询 SQL','sql',{step:1}),f('MAP_SOURCE_QUERY_SQL','可选资料 SQL','sql',{step:2}),f('MAP_SELECTED_QUERY_SQL','已选资料 SQL','sql',{step:2}),
      f('LOG_QUERY_SQL','履历 SQL','sql',{step:3}),f('COLUMNS_JSON','显示栏位','json',{step:3}),
    ]
  }
}
