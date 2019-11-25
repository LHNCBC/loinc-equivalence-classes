// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'COAG';

require('../util').genTableAndResults(loincCls, ['COMPONENT', 'PROPERTY_REV',
  'SYSTEM_REV', 'METHOD_REV'], async function(equivTable, util) {

  const clsConfig = require('./config');

  let {request, query, dupColumn, dupAndApplyGroups, applyGroupSkipValues} = util;

  // PROPERTY_REV
  await dupAndApplyGroups(equivTable, 'PROPERTY', clsConfig.PROPERTY);

  // SYSTEM_REV
  await dupAndApplyGroups(equivTable, 'SYSTEM', clsConfig.SYSTEMCORE);

  // METHOD_REV
  await dupColumn(equivTable, 'METHOD_TYP', 'METHOD_REV');
  groupName = 'Method-Other';
  skipValues = clsConfig.METHOD[groupName].skip;
  await applyGroupSkipValues(equivTable, 'METHOD_REV', skipValues, groupName);
});
