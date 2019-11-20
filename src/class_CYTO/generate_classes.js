// A program to generate the equivalence classes for the LOINC class (loincCls) below.
const loincCls = 'CYTO';

require('../util').genTableAndResults(loincCls, ['COMPONENT_REV', 'SYSTEM_REV'],
  async function(equivTable, util) {

  const clsConfig = require('./config');

  let {request, query, dupColumn, dupAndApplyGroups, applyGroupSkipValues} = util;

  // COMPONENT_REV
  await dupAndApplyGroups(equivTable, 'COMPONENT', clsConfig.COMPONENT);

  // SYSTEM_REV
  await dupAndApplyGroups(equivTable, 'SYSTEM', clsConfig.SYSTEM);
});
