export const textOps = [['contains','包含'],['notContains','不包含'],['starts','开头为'],['ends','结尾为'],['eq','等于'],['neq','不等于']]
export const dateOps = [['between','介于'],['eq','等于'],['neq','不等于'],['lt','小于'],['lte','小于等于'],['gt','大于'],['gte','大于等于']]
export const isDate = c => c.type === 'date' || /(_DT|_DATE)$/.test(c.field || c.name)
export const emptyFilter = c => ({enabled:false,type:isDate(c)?'date':'text',operator:isDate(c)?'between':'contains',value:'',from:'',to:''})
export function matches(raw, c) {
  if (!c || !c.enabled || (!c.value && !c.from && !c.to)) return true
  if (c.type === 'date') {
    const seconds = v => Math.floor(new Date(v).getTime()/1000)
    const a=seconds(raw), b=seconds(c.value)
    if(raw==null || raw==='' || !Number.isFinite(a)) return false
    return {between:()=> (!c.from || a>=seconds(c.from)) && (!c.to || a<=seconds(c.to)),
      eq:()=>a===b,neq:()=>a!==b,lt:()=>a<b,lte:()=>a<=b,gt:()=>a>b,gte:()=>a>=b}[c.operator]?.() ?? false
  }
  const a=String(raw??'').toLowerCase(),b=c.value.toLowerCase()
  return {contains:()=>a.includes(b),notContains:()=>!a.includes(b),starts:()=>a.startsWith(b),
    ends:()=>a.endsWith(b),eq:()=>a===b,neq:()=>a!==b}[c.operator]?.() ?? false
}
export function toServerConditions(conditions) {
  return Object.fromEntries(Object.entries(conditions).map(([k,c])=>[k,c.type!=='date'?{...c}:{
    ...c,...Object.fromEntries(['value','from','to'].map(f=>[f,c[f]?new Date(c[f]).toISOString():'']))
  }]))
}
