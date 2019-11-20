// A program to generate the equivalence classes for ABXBACT
const loincCls = 'ABXBACT';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'SCALE_REV', 'METHOD_REV'],
  async function(equivTable, util) {

  const clsConfig = require('./config');

  let {dupColumn, applyGroupSkipValues} = util;

  // SCALE_REV
  await dupColumn(equivTable, 'SCALE_TYP', 'SCALE_REV');
  let groupName = 'Scale-Other';
  let skipValues = clsConfig.SCALE[groupName].skip;
  await applyGroupSkipValues(equivTable, 'SCALE_REV', skipValues, groupName);

  // METHOD_REV
  await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV');
  groupName = 'Method-Other';
  skipValues = clsConfig.METHOD[groupName].skip;
  await applyGroupSkipValues(equivTable, 'METHOD_REV', skipValues, groupName);
});
