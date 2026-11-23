'use strict';

const { resetDb } = require('../src/db');

resetDb();
console.log('AMS 资料已重置，重新启动服务即可载入种子资料。');
